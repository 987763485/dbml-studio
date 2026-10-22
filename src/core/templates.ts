export interface Template {
  id: string;
  name: string;
  description: string;
  accent: string;
  content: string;
}

const blank = `Project my_project {
  database_type: 'PostgreSQL'
}
`;

const blog = `Project blog {
  database_type: 'PostgreSQL'
  Note: '博客示例：作者、文章、评论与标签'
}

Table users [headercolor: #0ea5e9, note: '站点用户'] {
  id integer [pk, increment]
  email varchar(255) [unique, not null]
  display_name varchar(80) [not null]
  bio text
  created_at timestamp [not null, default: \`now()\`]
}

Table posts [headercolor: #6366f1] {
  id integer [pk, increment]
  author_id integer [not null]
  title varchar(200) [not null]
  slug varchar(220) [unique, not null]
  content text
  status post_status [not null, default: 'draft']
  published_at timestamp
  created_at timestamp [not null, default: \`now()\`]

  indexes {
    (author_id, created_at) [name: 'idx_posts_author_created']
  }
}

Table comments [headercolor: #10b981] {
  id integer [pk, increment]
  post_id integer [not null]
  author_id integer [not null]
  parent_id integer
  body text [not null]
  created_at timestamp [not null, default: \`now()\`]
}

Table tags [headercolor: #f59e0b] {
  id integer [pk, increment]
  name varchar(40) [unique, not null]
  color varchar(7)
}

Table post_tags [headercolor: #94a3b8] {
  post_id integer [not null]
  tag_id integer [not null]

  indexes {
    (post_id, tag_id) [pk]
  }
}

Enum post_status {
  draft
  in_review
  published
  archived
}

Ref: posts.author_id > users.id [delete: cascade]
Ref: comments.post_id > posts.id [delete: cascade]
Ref: comments.author_id > users.id
Ref: comments.parent_id >? comments.id [delete: set null]
Ref: post_tags.post_id > posts.id [delete: cascade]
Ref: post_tags.tag_id > tags.id [delete: cascade]

TableGroup content {
  posts
  comments
  tags
  post_tags
}
`;

const shop = `Project shop {
  database_type: 'PostgreSQL'
  Note: '电商示例：商品、订单与支付'
}

Table users [headercolor: #0ea5e9] {
  id integer [pk, increment]
  email varchar(255) [unique, not null]
  name varchar(80) [not null]
  created_at timestamp [not null, default: \`now()\`]
}

Table addresses [headercolor: #38bdf8] {
  id integer [pk, increment]
  user_id integer [not null]
  receiver varchar(80) [not null]
  phone varchar(30)
  line1 varchar(200) [not null]
  city varchar(80) [not null]
  country varchar(80) [not null]
}

Table categories [headercolor: #f59e0b] {
  id integer [pk, increment]
  name varchar(80) [not null]
  parent_id integer
}

Table products [headercolor: #10b981] {
  id integer [pk, increment]
  category_id integer
  name varchar(160) [not null]
  sku varchar(60) [unique, not null]
  price decimal(10,2) [not null]
  stock integer [not null, default: 0]
  status product_status [not null, default: 'active']
}

Table orders [headercolor: #6366f1] {
  id integer [pk, increment]
  user_id integer [not null]
  address_id integer
  status order_status [not null, default: 'pending']
  total decimal(12,2) [not null, default: 0]
  created_at timestamp [not null, default: \`now()\`]

  indexes {
    (user_id, created_at) [name: 'idx_orders_user_created']
  }
}

Table order_items [headercolor: #8b5cf6] {
  id integer [pk, increment]
  order_id integer [not null]
  product_id integer [not null]
  quantity integer [not null, default: 1]
  unit_price decimal(10,2) [not null]

  indexes {
    (order_id, product_id) [unique]
  }
}

Table payments [headercolor: #ec4899] {
  id integer [pk, increment]
  order_id integer [not null]
  provider varchar(40) [not null]
  amount decimal(12,2) [not null]
  paid_at timestamp
}

Enum order_status {
  pending
  paid
  shipped
  completed
  cancelled
}

Enum product_status {
  active
  draft
  archived
}

Ref: addresses.user_id > users.id [delete: cascade]
Ref: products.category_id >? categories.id [delete: set null]
Ref: orders.user_id > users.id
Ref: orders.address_id >? addresses.id [delete: set null]
Ref: order_items.order_id > orders.id [delete: cascade]
Ref: order_items.product_id > products.id
Ref: payments.order_id > orders.id [delete: cascade]
Ref: categories.parent_id >? categories.id [delete: set null]

TableGroup sales {
  orders
  order_items
  payments
}

TableGroup catalog {
  categories
  products
}
`;

const saas = `Project saas {
  database_type: 'PostgreSQL'
  Note: '多租户 SaaS 示例：组织、成员与项目'
}

Table auth.users [headercolor: #6366f1] {
  id uuid [pk]
  email varchar(255) [unique, not null]
  password_hash varchar(255) [not null]
  created_at timestamp [not null, default: \`now()\`]
}

Table app.organizations [headercolor: #0ea5e9] {
  id uuid [pk]
  name varchar(120) [not null]
  slug varchar(80) [unique, not null]
  plan plan_tier [not null, default: 'free']
  created_at timestamp [not null, default: \`now()\`]
}

Table app.memberships [headercolor: #10b981] {
  id integer [pk, increment]
  org_id uuid [not null]
  user_id uuid [not null]
  role member_role [not null, default: 'member']
  joined_at timestamp [not null, default: \`now()\`]

  indexes {
    (org_id, user_id) [unique]
  }
}

Table app.projects [headercolor: #f59e0b] {
  id uuid [pk]
  org_id uuid [not null]
  name varchar(160) [not null]
  created_by uuid [not null]
  archived_at timestamp
}

Table app.api_keys [headercolor: #ec4899] {
  id uuid [pk]
  org_id uuid [not null]
  name varchar(80) [not null]
  token_prefix varchar(12) [unique, not null]
  last_used_at timestamp
  expires_at timestamp
}

Table app.audit_logs [headercolor: #94a3b8] {
  id bigint [pk, increment]
  org_id uuid [not null]
  actor_id uuid
  action varchar(80) [not null]
  target_type varchar(60)
  target_id varchar(80)
  created_at timestamp [not null, default: \`now()\`]

  indexes {
    (org_id, created_at) [name: 'idx_audit_org_created']
  }
}

Enum plan_tier {
  free
  team
  business
  enterprise
}

Enum member_role {
  owner
  admin
  member
  viewer
}

Ref: app.organizations.id < app.memberships.org_id [delete: cascade]
Ref: auth.users.id < app.memberships.user_id [delete: cascade]
Ref: app.organizations.id < app.projects.org_id [delete: cascade]
Ref: auth.users.id < app.projects.created_by
Ref: app.organizations.id < app.api_keys.org_id [delete: cascade]
Ref: app.organizations.id < app.audit_logs.org_id [delete: cascade]
Ref: app.audit_logs.actor_id >? auth.users.id [delete: set null]

TableGroup tenancy {
  app.organizations
  app.memberships
  app.api_keys
}
`;

export const templates: Template[] = [
  {
    id: 'blank',
    name: '空白项目',
    description: '从 Project 声明开始，自己搭建模型',
    accent: '#64748b',
    content: blank,
  },
  {
    id: 'blog',
    name: '博客系统',
    description: '文章、评论、标签与作者关系',
    accent: '#6366f1',
    content: blog,
  },
  {
    id: 'shop',
    name: '电商订单',
    description: '商品、订单、支付与状态枚举',
    accent: '#f59e0b',
    content: shop,
  },
  {
    id: 'saas',
    name: 'SaaS 多租户',
    description: '组织、成员、项目与审计日志',
    accent: '#0ea5e9',
    content: saas,
  },
];

export function findTemplate(id: string): Template {
  return templates.find((template) => template.id === id) ?? templates[0];
}
