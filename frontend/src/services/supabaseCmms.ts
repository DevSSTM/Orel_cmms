import { createClient, SupabaseClient } from '@supabase/supabase-js';

// Only a Supabase publishable/anon key belongs in the browser. Never use a
// service-role or secret key here: authorization is enforced by database RLS.
const url = process.env.REACT_APP_SUPABASE_URL;
const publishableKey = process.env.REACT_APP_SUPABASE_PUBLISHABLE_KEY;

let client: SupabaseClient | undefined;

export function getSupabaseClient(): SupabaseClient {
  if (!url || !publishableKey) {
    throw new Error('Supabase URL and publishable key are not configured');
  }
  if (!client) client = createClient(url, publishableKey);
  return client;
}

export interface CmmsAsset {
  id: string;
  organization_id: string;
  name: string;
  description: string | null;
  created_at: string;
}

export interface CmmsOrganization {
  id: string;
  name: string;
}

export async function listOrganizations(): Promise<CmmsOrganization[]> {
  const { data, error } = await getSupabaseClient()
    .from('cmms_organizations')
    .select('id, name')
    .order('name');
  if (error) throw error;
  return data as CmmsOrganization[];
}

export async function signUp(email: string, password: string) {
  const { data, error } = await getSupabaseClient().auth.signUp({
    email,
    password
  });
  if (error) throw error;
  return data;
}

export interface CmmsWorkOrder {
  id: string;
  organization_id: string;
  asset_id: string | null;
  title: string;
  description: string | null;
  status: 'open' | 'in_progress' | 'on_hold' | 'completed' | 'cancelled';
  priority: 'low' | 'medium' | 'high' | 'urgent';
  due_at: string | null;
  created_at: string;
}

export async function signIn(email: string, password: string) {
  const { data, error } = await getSupabaseClient().auth.signInWithPassword({
    email,
    password
  });
  if (error) throw error;
  return data;
}

export async function signOut(): Promise<void> {
  const { error } = await getSupabaseClient().auth.signOut();
  if (error) throw error;
}

export async function createOrganization(name: string): Promise<string> {
  const { data, error } = await getSupabaseClient().rpc(
    'cmms_create_organization',
    { organization_name: name }
  );
  if (error) throw error;
  return data as string;
}

export async function listAssets(organizationId: string): Promise<CmmsAsset[]> {
  const { data, error } = await getSupabaseClient()
    .from('cmms_assets')
    .select('*')
    .eq('organization_id', organizationId)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return data as CmmsAsset[];
}

export async function createAsset(input: {
  organization_id: string;
  name: string;
  description?: string | null;
}): Promise<CmmsAsset> {
  const { data, error } = await getSupabaseClient()
    .from('cmms_assets')
    .insert(input)
    .select()
    .single();
  if (error) throw error;
  return data as CmmsAsset;
}

export async function listWorkOrders(
  organizationId: string
): Promise<CmmsWorkOrder[]> {
  const { data, error } = await getSupabaseClient()
    .from('cmms_work_orders')
    .select('*')
    .eq('organization_id', organizationId)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return data as CmmsWorkOrder[];
}

export async function createWorkOrder(input: {
  organization_id: string;
  title: string;
  asset_id?: string | null;
  description?: string | null;
  priority?: CmmsWorkOrder['priority'];
  due_at?: string | null;
}): Promise<CmmsWorkOrder> {
  const { data, error } = await getSupabaseClient()
    .from('cmms_work_orders')
    .insert(input)
    .select()
    .single();
  if (error) throw error;
  return data as CmmsWorkOrder;
}

export async function updateWorkOrder(
  organizationId: string,
  id: string,
  changes: Partial<
    Pick<
      CmmsWorkOrder,
      'title' | 'description' | 'status' | 'priority' | 'asset_id' | 'due_at'
    >
  >
): Promise<CmmsWorkOrder> {
  const { data, error } = await getSupabaseClient()
    .from('cmms_work_orders')
    .update(changes)
    .eq('organization_id', organizationId)
    .eq('id', id)
    .select()
    .single();
  if (error) throw error;
  return data as CmmsWorkOrder;
}
