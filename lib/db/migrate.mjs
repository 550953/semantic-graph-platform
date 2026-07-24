import pkg from '/home/runner/workspace/node_modules/.pnpm/pg@8.22.0/node_modules/pg/lib/index.js';
const { Client } = pkg;

const sql = `
CREATE TABLE IF NOT EXISTS "workspaces" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "name" text NOT NULL,
  "slug" text NOT NULL,
  "description" text,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "workspaces_slug_unique" UNIQUE("slug")
);

CREATE TABLE IF NOT EXISTS "portfolios" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "workspace_id" uuid NOT NULL,
  "name" text NOT NULL,
  "slug" text NOT NULL,
  "description" text,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "projects" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "workspace_id" uuid NOT NULL,
  "portfolio_id" uuid,
  "name" text NOT NULL,
  "slug" text NOT NULL,
  "description" text,
  "status" text DEFAULT 'active' NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "actors" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "workspace_id" uuid NOT NULL,
  "type" text DEFAULT 'human' NOT NULL,
  "name" text NOT NULL,
  "email" text,
  "metadata" jsonb DEFAULT '{}'::jsonb,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "node_types" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "workspace_id" uuid NOT NULL,
  "name" text NOT NULL,
  "slug" text NOT NULL,
  "description" text,
  "color" text,
  "icon" text,
  "metadata" jsonb DEFAULT '{}'::jsonb,
  "is_system" boolean DEFAULT false NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "edge_types" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "workspace_id" uuid NOT NULL,
  "name" text NOT NULL,
  "slug" text NOT NULL,
  "description" text,
  "source_node_type_id" uuid,
  "target_node_type_id" uuid,
  "is_directed" boolean DEFAULT true NOT NULL,
  "metadata" jsonb DEFAULT '{}'::jsonb,
  "is_system" boolean DEFAULT false NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "nodes" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "project_id" uuid NOT NULL,
  "node_type_id" uuid NOT NULL,
  "name" text NOT NULL,
  "description" text,
  "properties" jsonb DEFAULT '{}'::jsonb,
  "created_by_id" uuid,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "edges" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "project_id" uuid NOT NULL,
  "edge_type_id" uuid NOT NULL,
  "source_node_id" uuid NOT NULL,
  "target_node_id" uuid NOT NULL,
  "properties" jsonb DEFAULT '{}'::jsonb,
  "created_by_id" uuid,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "issues" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "project_id" uuid NOT NULL,
  "type" text DEFAULT 'task' NOT NULL,
  "title" text NOT NULL,
  "description" text,
  "status" text DEFAULT 'open' NOT NULL,
  "priority" text DEFAULT 'medium' NOT NULL,
  "assignee_id" uuid,
  "reporter_id" uuid,
  "parent_id" uuid,
  "metadata" jsonb DEFAULT '{}'::jsonb,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
`;

const fkSql = `
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'portfolios_workspace_id_workspaces_id_fk') THEN
    ALTER TABLE "portfolios" ADD CONSTRAINT "portfolios_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "workspaces"("id") ON DELETE cascade;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'projects_workspace_id_workspaces_id_fk') THEN
    ALTER TABLE "projects" ADD CONSTRAINT "projects_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "workspaces"("id") ON DELETE cascade;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'projects_portfolio_id_portfolios_id_fk') THEN
    ALTER TABLE "projects" ADD CONSTRAINT "projects_portfolio_id_portfolios_id_fk" FOREIGN KEY ("portfolio_id") REFERENCES "portfolios"("id") ON DELETE set null;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'actors_workspace_id_workspaces_id_fk') THEN
    ALTER TABLE "actors" ADD CONSTRAINT "actors_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "workspaces"("id") ON DELETE cascade;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'node_types_workspace_id_workspaces_id_fk') THEN
    ALTER TABLE "node_types" ADD CONSTRAINT "node_types_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "workspaces"("id") ON DELETE cascade;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'edge_types_workspace_id_workspaces_id_fk') THEN
    ALTER TABLE "edge_types" ADD CONSTRAINT "edge_types_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "workspaces"("id") ON DELETE cascade;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'edge_types_source_node_type_id_node_types_id_fk') THEN
    ALTER TABLE "edge_types" ADD CONSTRAINT "edge_types_source_node_type_id_node_types_id_fk" FOREIGN KEY ("source_node_type_id") REFERENCES "node_types"("id") ON DELETE set null;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'edge_types_target_node_type_id_node_types_id_fk') THEN
    ALTER TABLE "edge_types" ADD CONSTRAINT "edge_types_target_node_type_id_node_types_id_fk" FOREIGN KEY ("target_node_type_id") REFERENCES "node_types"("id") ON DELETE set null;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'nodes_project_id_projects_id_fk') THEN
    ALTER TABLE "nodes" ADD CONSTRAINT "nodes_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE cascade;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'nodes_node_type_id_node_types_id_fk') THEN
    ALTER TABLE "nodes" ADD CONSTRAINT "nodes_node_type_id_node_types_id_fk" FOREIGN KEY ("node_type_id") REFERENCES "node_types"("id") ON DELETE restrict;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'nodes_created_by_id_actors_id_fk') THEN
    ALTER TABLE "nodes" ADD CONSTRAINT "nodes_created_by_id_actors_id_fk" FOREIGN KEY ("created_by_id") REFERENCES "actors"("id") ON DELETE set null;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'edges_project_id_projects_id_fk') THEN
    ALTER TABLE "edges" ADD CONSTRAINT "edges_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE cascade;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'edges_edge_type_id_edge_types_id_fk') THEN
    ALTER TABLE "edges" ADD CONSTRAINT "edges_edge_type_id_edge_types_id_fk" FOREIGN KEY ("edge_type_id") REFERENCES "edge_types"("id") ON DELETE restrict;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'edges_source_node_id_nodes_id_fk') THEN
    ALTER TABLE "edges" ADD CONSTRAINT "edges_source_node_id_nodes_id_fk" FOREIGN KEY ("source_node_id") REFERENCES "nodes"("id") ON DELETE cascade;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'edges_target_node_id_nodes_id_fk') THEN
    ALTER TABLE "edges" ADD CONSTRAINT "edges_target_node_id_nodes_id_fk" FOREIGN KEY ("target_node_id") REFERENCES "nodes"("id") ON DELETE cascade;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'edges_created_by_id_actors_id_fk') THEN
    ALTER TABLE "edges" ADD CONSTRAINT "edges_created_by_id_actors_id_fk" FOREIGN KEY ("created_by_id") REFERENCES "actors"("id") ON DELETE set null;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'issues_project_id_projects_id_fk') THEN
    ALTER TABLE "issues" ADD CONSTRAINT "issues_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE cascade;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'issues_assignee_id_actors_id_fk') THEN
    ALTER TABLE "issues" ADD CONSTRAINT "issues_assignee_id_actors_id_fk" FOREIGN KEY ("assignee_id") REFERENCES "actors"("id") ON DELETE set null;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'issues_reporter_id_actors_id_fk') THEN
    ALTER TABLE "issues" ADD CONSTRAINT "issues_reporter_id_actors_id_fk" FOREIGN KEY ("reporter_id") REFERENCES "actors"("id") ON DELETE set null;
  END IF;
END $$;
`;

const client = new Client({ connectionString: process.env.DATABASE_URL });
await client.connect();
console.log('Connected to Supabase');

await client.query(sql);
console.log('Tables created');

await client.query(fkSql);
console.log('Foreign keys applied');

const res = await client.query(`
  SELECT table_name FROM information_schema.tables
  WHERE table_schema = 'public'
  AND table_name IN ('workspaces','portfolios','projects','actors','node_types','edge_types','nodes','edges','issues')
  ORDER BY table_name;
`);
console.log('Verified tables:', res.rows.map(r => r.table_name).join(', '));

await client.end();
console.log('Done');
