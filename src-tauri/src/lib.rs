use base64::{engine::general_purpose::STANDARD as BASE64, Engine as _};
use serde::{Deserialize, Serialize};
use std::collections::hash_map::DefaultHasher;
use std::fs;
use std::hash::{Hash, Hasher};
use std::io::Write;
use std::path::{Path, PathBuf};
use std::process::Command;
use std::time::{SystemTime, UNIX_EPOCH};
use tauri::menu::{
    AboutMetadata, MenuBuilder, MenuItemBuilder, PredefinedMenuItem, SubmenuBuilder,
};
use tauri::{AppHandle, Emitter, Manager};

const RECOVERY_RETENTION_DAYS: u64 = 7;
const RECOVERY_KEEP_PER_DOC: usize = 5;

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
struct FileSnapshot {
    path: String,
    content: String,
    modified_at: Option<u64>,
    size: u64,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct SaveOptions {
    #[serde(default = "default_true")]
    backup: bool,
}

fn default_true() -> bool {
    true
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
struct SaveResult {
    path: String,
    bytes: u64,
    saved_at: u64,
    backup_path: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
struct RecoverySnapshot {
    id: String,
    doc_id: String,
    path: Option<String>,
    file_name: String,
    content: String,
    saved_at: u64,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
struct RecoveryMeta {
    id: String,
    doc_id: String,
    path: Option<String>,
    file_name: String,
    saved_at: u64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
struct RecentFile {
    path: String,
    name: String,
    last_opened: u64,
    #[serde(default)]
    exists: bool,
}

fn now_ms() -> u64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|d| d.as_millis() as u64)
        .unwrap_or(0)
}

fn modified_ms(path: &Path) -> Option<u64> {
    fs::metadata(path)
        .ok()
        .and_then(|m| m.modified().ok())
        .and_then(|t| t.duration_since(UNIX_EPOCH).ok())
        .map(|d| d.as_millis() as u64)
}

fn atomic_write(path: &Path, bytes: &[u8]) -> Result<(), String> {
    let parent = path
        .parent()
        .ok_or_else(|| "目标路径没有父目录".to_string())?;
    fs::create_dir_all(parent).map_err(|e| format!("无法创建目录：{e}"))?;

    let file_name = path
        .file_name()
        .and_then(|n| n.to_str())
        .ok_or_else(|| "目标文件名无效".to_string())?;
    let temp_name = format!(".{file_name}.dbml-studio-{}-{}.tmp", std::process::id(), now_ms());
    let temp_path = parent.join(temp_name);

    let result = (|| -> Result<(), String> {
        let mut file = fs::OpenOptions::new()
            .write(true)
            .create_new(true)
            .open(&temp_path)
            .map_err(|e| format!("无法创建临时文件：{e}"))?;
        file.write_all(bytes)
            .map_err(|e| format!("写入失败：{e}"))?;
        file.sync_all().map_err(|e| format!("同步文件失败：{e}"))?;
        drop(file);
        fs::rename(&temp_path, path).map_err(|e| format!("替换目标文件失败：{e}"))?;
        Ok(())
    })();

    if result.is_err() {
        let _ = fs::remove_file(&temp_path);
    }
    result
}

#[tauri::command]
fn read_text_file(path: String) -> Result<FileSnapshot, String> {
    let p = PathBuf::from(&path);
    let content = fs::read_to_string(&p).map_err(|e| format!("无法读取文件：{e}"))?;
    let size = fs::metadata(&p).map(|m| m.len()).unwrap_or(content.len() as u64);
    Ok(FileSnapshot {
        path,
        content,
        modified_at: modified_ms(&p),
        size,
    })
}

#[tauri::command]
fn save_text_atomic(
    path: String,
    content: String,
    options: Option<SaveOptions>,
) -> Result<SaveResult, String> {
    let p = PathBuf::from(&path);
    let options = options.unwrap_or(SaveOptions { backup: true });
    let mut backup_path = None;

    if options.backup && p.exists() {
        let bak = PathBuf::from(format!("{path}.bak"));
        fs::copy(&p, &bak).map_err(|e| format!("备份原文件失败：{e}"))?;
        backup_path = Some(bak.to_string_lossy().to_string());
    }

    atomic_write(&p, content.as_bytes())?;
    Ok(SaveResult {
        path,
        bytes: content.len() as u64,
        saved_at: now_ms(),
        backup_path,
    })
}

fn layout_path(doc_path: &str) -> PathBuf {
    PathBuf::from(format!("{doc_path}.layout.json"))
}

#[tauri::command]
fn load_layout(doc_path: String) -> Result<Option<serde_json::Value>, String> {
    let path = layout_path(&doc_path);
    if !path.exists() {
        return Ok(None);
    }
    let raw = fs::read_to_string(&path).map_err(|e| format!("无法读取布局文件：{e}"))?;
    let value = serde_json::from_str(&raw).map_err(|e| format!("布局文件格式错误：{e}"))?;
    Ok(Some(value))
}

#[tauri::command]
fn save_layout(doc_path: String, layout: serde_json::Value) -> Result<(), String> {
    let path = layout_path(&doc_path);
    let raw = serde_json::to_vec_pretty(&layout).map_err(|e| format!("布局序列化失败：{e}"))?;
    atomic_write(&path, &raw)
}

fn hash_doc_id(doc_id: &str) -> String {
    let mut hasher = DefaultHasher::new();
    doc_id.hash(&mut hasher);
    format!("{:016x}", hasher.finish())
}

fn recovery_dir(app: &AppHandle) -> Result<PathBuf, String> {
    let dir = app
        .path()
        .app_data_dir()
        .map_err(|e| format!("无法定位应用数据目录：{e}"))?
        .join("recovery");
    fs::create_dir_all(&dir).map_err(|e| format!("无法创建恢复目录：{e}"))?;
    Ok(dir)
}

fn recovery_meta(snapshot: &RecoverySnapshot) -> RecoveryMeta {
    RecoveryMeta {
        id: snapshot.id.clone(),
        doc_id: snapshot.doc_id.clone(),
        path: snapshot.path.clone(),
        file_name: snapshot.file_name.clone(),
        saved_at: snapshot.saved_at,
    }
}

fn read_snapshot(path: &Path) -> Option<RecoverySnapshot> {
    let raw = fs::read_to_string(path).ok()?;
    serde_json::from_str(&raw).ok()
}

#[tauri::command]
fn recovery_save(
    app: AppHandle,
    doc_id: String,
    path: Option<String>,
    file_name: String,
    content: String,
) -> Result<RecoveryMeta, String> {
    let dir = recovery_dir(&app)?;
    let hash = hash_doc_id(&doc_id);

    // 同一毫秒内重复保存时追加序号，避免覆盖。
    let stamp = now_ms();
    let mut id = format!("{hash}_{stamp}");
    let mut seq = 1;
    while dir.join(format!("{id}.json")).exists() {
        id = format!("{hash}_{stamp}_{seq}");
        seq += 1;
    }

    let snapshot = RecoverySnapshot {
        id: id.clone(),
        doc_id,
        path,
        file_name,
        content,
        saved_at: stamp,
    };
    let raw = serde_json::to_vec(&snapshot).map_err(|e| format!("恢复快照序列化失败：{e}"))?;
    atomic_write(&dir.join(format!("{id}.json")), &raw)?;

    prune_recovery(&dir, &hash);
    Ok(recovery_meta(&snapshot))
}

fn prune_recovery(dir: &Path, hash: &str) {
    let cutoff = now_ms().saturating_sub(RECOVERY_RETENTION_DAYS * 24 * 60 * 60 * 1000);
    let mut entries: Vec<(u64, PathBuf)> = Vec::new();

    let Ok(read_dir) = fs::read_dir(dir) else {
        return;
    };
    for entry in read_dir.flatten() {
        let path = entry.path();
        let Some(name) = path.file_name().and_then(|n| n.to_str()) else {
            continue;
        };
        if !name.starts_with(hash) || !name.ends_with(".json") {
            continue;
        }
        let Some(snapshot) = read_snapshot(&path) else {
            let _ = fs::remove_file(&path);
            continue;
        };
        if snapshot.saved_at < cutoff {
            let _ = fs::remove_file(&path);
        } else {
            entries.push((snapshot.saved_at, path));
        }
    }

    entries.sort_by(|a, b| b.0.cmp(&a.0));
    for (_, path) in entries.into_iter().skip(RECOVERY_KEEP_PER_DOC) {
        let _ = fs::remove_file(&path);
    }
}

#[tauri::command]
fn recovery_list(app: AppHandle) -> Result<Vec<RecoveryMeta>, String> {
    let dir = recovery_dir(&app)?;
    let mut snapshots: Vec<RecoverySnapshot> = Vec::new();
    let read_dir = fs::read_dir(&dir).map_err(|e| format!("无法读取恢复目录：{e}"))?;
    for entry in read_dir.flatten() {
        let path = entry.path();
        if path.extension().and_then(|e| e.to_str()) != Some("json") {
            continue;
        }
        if let Some(snapshot) = read_snapshot(&path) {
            snapshots.push(snapshot);
        }
    }
    snapshots.sort_by(|a, b| b.saved_at.cmp(&a.saved_at));
    Ok(snapshots.iter().map(recovery_meta).collect())
}

fn validate_snapshot_id(id: &str) -> Result<(), String> {
    if id.is_empty()
        || !id
            .chars()
            .all(|c| c.is_ascii_alphanumeric() || c == '_' || c == '-')
    {
        return Err("恢复快照 ID 无效".to_string());
    }
    Ok(())
}

#[tauri::command]
fn recovery_load(app: AppHandle, id: String) -> Result<RecoverySnapshot, String> {
    validate_snapshot_id(&id)?;
    let path = recovery_dir(&app)?.join(format!("{id}.json"));
    read_snapshot(&path).ok_or_else(|| "恢复快照不存在或已损坏".to_string())
}

#[tauri::command]
fn recovery_discard(app: AppHandle, doc_id: String) -> Result<(), String> {
    let dir = recovery_dir(&app)?;
    let hash = hash_doc_id(&doc_id);
    let read_dir = fs::read_dir(&dir).map_err(|e| format!("无法读取恢复目录：{e}"))?;
    for entry in read_dir.flatten() {
        let path = entry.path();
        if let Some(name) = path.file_name().and_then(|n| n.to_str()) {
            if name.starts_with(&hash) && name.ends_with(".json") {
                let _ = fs::remove_file(path);
            }
        }
    }
    Ok(())
}

fn recent_path(app: &AppHandle) -> Result<PathBuf, String> {
    let dir = app
        .path()
        .app_config_dir()
        .map_err(|e| format!("无法定位应用配置目录：{e}"))?;
    fs::create_dir_all(&dir).map_err(|e| format!("无法创建配置目录：{e}"))?;
    Ok(dir.join("recent.json"))
}

fn read_recent_file(app: &AppHandle) -> Vec<RecentFile> {
    let Ok(path) = recent_path(app) else {
        return Vec::new();
    };
    let Ok(raw) = fs::read_to_string(path) else {
        return Vec::new();
    };
    serde_json::from_str(&raw).unwrap_or_default()
}

fn with_existence(mut files: Vec<RecentFile>) -> Vec<RecentFile> {
    for file in &mut files {
        file.exists = Path::new(&file.path).exists();
    }
    files
}

fn write_recent_file(app: &AppHandle, files: &[RecentFile]) -> Result<(), String> {
    let path = recent_path(app)?;
    let raw = serde_json::to_vec_pretty(files).map_err(|e| format!("最近文件序列化失败：{e}"))?;
    atomic_write(&path, &raw)
}

#[tauri::command]
fn recent_files(app: AppHandle) -> Result<Vec<RecentFile>, String> {
    let files = read_recent_file(&app);
    Ok(with_existence(files))
}

#[tauri::command]
fn touch_recent(app: AppHandle, path: String, name: String) -> Result<Vec<RecentFile>, String> {
    let mut files = read_recent_file(&app);
    files.retain(|file| file.path != path);
    files.insert(
        0,
        RecentFile {
            path,
            name,
            last_opened: now_ms(),
            exists: true,
        },
    );
    files.truncate(10);
    write_recent_file(&app, &files)?;
    Ok(with_existence(files))
}

#[tauri::command]
fn remove_recent(app: AppHandle, path: String) -> Result<Vec<RecentFile>, String> {
    let mut files = read_recent_file(&app);
    files.retain(|file| file.path != path);
    write_recent_file(&app, &files)?;
    Ok(with_existence(files))
}

#[tauri::command]
fn export_binary_file(path: String, data_base64: String) -> Result<(), String> {
    let encoded = data_base64
        .split_once(',')
        .map(|(_, data)| data)
        .unwrap_or(data_base64.as_str());
    let bytes = BASE64
        .decode(encoded)
        .map_err(|e| format!("二进制数据解码失败：{e}"))?;
    atomic_write(Path::new(&path), &bytes)
}

#[tauri::command]
fn reveal_in_file_manager(path: String) -> Result<(), String> {
    let p = PathBuf::from(&path);
    #[cfg(target_os = "macos")]
    {
        Command::new("open")
            .arg("-R")
            .arg(&p)
            .spawn()
            .map_err(|e| format!("无法打开 Finder：{e}"))?;
    }
    #[cfg(target_os = "windows")]
    {
        Command::new("explorer")
            .arg(format!("/select,{}", p.to_string_lossy()))
            .spawn()
            .map_err(|e| format!("无法打开资源管理器：{e}"))?;
    }
    #[cfg(all(unix, not(target_os = "macos")))]
    {
        let target = p.parent().unwrap_or(&p);
        Command::new("xdg-open")
            .arg(target)
            .spawn()
            .map_err(|e| format!("无法打开文件管理器：{e}"))?;
    }
    Ok(())
}

#[tauri::command]
fn quit_app(app: AppHandle) {
    app.exit(0);
}

fn menu_item(
    app: &AppHandle,
    id: &str,
    label: &str,
    accelerator: Option<&str>,
) -> tauri::Result<tauri::menu::MenuItem<tauri::Wry>> {
    let mut builder = MenuItemBuilder::with_id(id, label);
    if let Some(accelerator) = accelerator {
        builder = builder.accelerator(accelerator);
    }
    builder.build(app)
}

fn build_menu(app: &AppHandle) -> tauri::Result<tauri::menu::Menu<tauri::Wry>> {
    let about = PredefinedMenuItem::about(
        app,
        Some("关于 DBML Studio"),
        Some(AboutMetadata {
            name: Some("DBML Studio".into()),
            version: Some(env!("CARGO_PKG_VERSION").into()),
            comments: Some("本地优先的 DBML 数据库建模工具".into()),
            ..Default::default()
        }),
    )?;

    let app_menu = SubmenuBuilder::new(app, "DBML Studio")
        .item(&about)
        .separator()
        .item(&PredefinedMenuItem::services(app, Some("服务"))?)
        .separator()
        .item(&PredefinedMenuItem::hide(app, Some("隐藏 DBML Studio"))?)
        .item(&PredefinedMenuItem::hide_others(app, Some("隐藏其他"))?)
        .item(&PredefinedMenuItem::show_all(app, Some("全部显示"))?)
        .separator()
        .item(&menu_item(app, "quit", "退出 DBML Studio", Some("CmdOrCtrl+Q"))?)
        .build()?;

    let file_menu = SubmenuBuilder::new(app, "文件")
        .item(&menu_item(app, "new", "新建文档", Some("CmdOrCtrl+N"))?)
        .item(&menu_item(app, "open", "打开…", Some("CmdOrCtrl+O"))?)
        .separator()
        .item(&menu_item(app, "save", "保存", Some("CmdOrCtrl+S"))?)
        .item(&menu_item(app, "save-as", "另存为…", Some("CmdOrCtrl+Shift+S"))?)
        .item(&menu_item(app, "export", "导出…", Some("CmdOrCtrl+E"))?)
        .separator()
        .item(&menu_item(app, "close-tab", "关闭标签页", Some("CmdOrCtrl+W"))?)
        .item(&menu_item(app, "close-window", "关闭窗口", Some("CmdOrCtrl+Shift+W"))?)
        .build()?;

    let edit_menu = SubmenuBuilder::new(app, "编辑")
        .item(&menu_item(app, "undo", "撤销", Some("CmdOrCtrl+Z"))?)
        .item(&menu_item(app, "redo", "重做", Some("CmdOrCtrl+Shift+Z"))?)
        .separator()
        .item(&PredefinedMenuItem::cut(app, Some("剪切"))?)
        .item(&PredefinedMenuItem::copy(app, Some("复制"))?)
        .item(&PredefinedMenuItem::paste(app, Some("粘贴"))?)
        .item(&PredefinedMenuItem::select_all(app, Some("全选"))?)
        .separator()
        .item(&menu_item(app, "find", "查找", Some("CmdOrCtrl+F"))?)
        .build()?;

    let view_menu = SubmenuBuilder::new(app, "视图")
        .item(&menu_item(app, "view-split", "分栏视图", Some("CmdOrCtrl+1"))?)
        .item(&menu_item(app, "view-editor", "代码视图", Some("CmdOrCtrl+2"))?)
        .item(&menu_item(app, "view-canvas", "画布视图", Some("CmdOrCtrl+3"))?)
        .separator()
        .item(&menu_item(app, "autolayout", "自动整理布局", Some("CmdOrCtrl+Shift+L"))?)
        .item(&menu_item(app, "fit", "适应画布", Some("CmdOrCtrl+Shift+F"))?)
        .separator()
        .item(&menu_item(app, "toggle-theme", "切换明暗主题", Some("CmdOrCtrl+Shift+D"))?)
        .item(&menu_item(app, "welcome", "返回欢迎页", None)?)
        .separator()
        .item(&menu_item(app, "settings", "设置…", Some("CmdOrCtrl+,"))?)
        .item(&menu_item(app, "shortcuts", "键盘快捷键", Some("CmdOrCtrl+/"))?)
        .build()?;

    let window_menu = SubmenuBuilder::new(app, "窗口")
        .item(&PredefinedMenuItem::minimize(app, Some("最小化"))?)
        .item(&PredefinedMenuItem::maximize(app, Some("缩放"))?)
        .item(&PredefinedMenuItem::fullscreen(app, Some("切换全屏"))?)
        .build()?;

    let help_menu = SubmenuBuilder::new(app, "帮助")
        .item(&menu_item(app, "shortcuts-help", "键盘快捷键", None)?)
        .build()?;

    MenuBuilder::new(app)
        .items(&[
            &app_menu,
            &file_menu,
            &edit_menu,
            &view_menu,
            &window_menu,
            &help_menu,
        ])
        .build()
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .menu(|app| build_menu(app))
        .on_menu_event(|app, event| {
            let action = event.id().as_ref().to_string();
            let event_name = if action == "shortcuts-help" {
                "shortcuts"
            } else {
                action.as_str()
            };
            let _ = app.emit("menu", event_name);
        })
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_window_state::Builder::default().build())
        .invoke_handler(tauri::generate_handler![
            read_text_file,
            save_text_atomic,
            load_layout,
            save_layout,
            recovery_save,
            recovery_list,
            recovery_load,
            recovery_discard,
            recent_files,
            touch_recent,
            remove_recent,
            export_binary_file,
            reveal_in_file_manager,
            quit_app
        ])
        .run(tauri::generate_context!())
        .expect("error while running DBML Studio");
}
