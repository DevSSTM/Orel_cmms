import { useCallback, useEffect, useState } from 'react';
import { Session } from '@supabase/supabase-js';
import {
  CmmsAsset,
  CmmsOrganization,
  CmmsWorkOrder,
  createAsset,
  createOrganization,
  createWorkOrder,
  getSupabaseClient,
  listAssets,
  listOrganizations,
  listWorkOrders,
  signIn,
  signOut,
  signUp,
  updateWorkOrder
} from './services/supabaseCmms';

export default function SupabaseApp() {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [organizations, setOrganizations] = useState<CmmsOrganization[]>([]);
  const [organizationId, setOrganizationId] = useState('');
  const [organizationName, setOrganizationName] = useState('');
  const [assets, setAssets] = useState<CmmsAsset[]>([]);
  const [orders, setOrders] = useState<CmmsWorkOrder[]>([]);
  const [assetName, setAssetName] = useState('');
  const [title, setTitle] = useState('');
  const [assetId, setAssetId] = useState('');
  const [busy, setBusy] = useState(false);

  const run = async (action: () => Promise<void>) => {
    setError('');
    setMessage('');
    setBusy(true);
    try {
      await action();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'An unexpected error occurred');
    } finally {
      setBusy(false);
    }
  };

  useEffect(() => {
    const client = getSupabaseClient();
    let active = true;
    client.auth.getSession().then(({ data, error: sessionError }) => {
      if (!active) return;
      if (sessionError) setError(sessionError.message);
      setSession(data.session);
      setLoading(false);
    });
    const { data } = client.auth.onAuthStateChange((_event, nextSession) => {
      if (active) setSession(nextSession);
    });
    return () => {
      active = false;
      data.subscription.unsubscribe();
    };
  }, []);

  const refreshOrganizations = useCallback(async () => {
    const result = await listOrganizations();
    setOrganizations(result);
    setOrganizationId((current) =>
      result.some((organization) => organization.id === current)
        ? current
        : result[0]?.id || ''
    );
  }, []);

  useEffect(() => {
    if (!session) {
      setOrganizations([]);
      setOrganizationId('');
      setAssets([]);
      setOrders([]);
      return;
    }
    refreshOrganizations().catch((e) => setError(e.message));
  }, [session, refreshOrganizations]);

  const refreshData = useCallback(async (id: string) => {
    const [nextAssets, nextOrders] = await Promise.all([
      listAssets(id),
      listWorkOrders(id)
    ]);
    setAssets(nextAssets);
    setOrders(nextOrders);
  }, []);

  useEffect(() => {
    setAssets([]);
    setOrders([]);
    setAssetId('');
    if (!organizationId || !session) return;
    let active = true;
    Promise.all([listAssets(organizationId), listWorkOrders(organizationId)])
      .then(([nextAssets, nextOrders]) => {
        if (active) {
          setAssets(nextAssets);
          setOrders(nextOrders);
        }
      })
      .catch((e) => active && setError(e.message));
    return () => {
      active = false;
    };
  }, [organizationId, session]);

  const submitAuth = (register: boolean) => {
    run(async () => {
      if (register) {
        const result = await signUp(email.trim(), password);
        if (!result.session)
          setMessage('Check your email to confirm your account, then sign in.');
      } else {
        await signIn(email.trim(), password);
      }
    });
  };

  if (loading) return <main>Loading…</main>;

  return (
    <main
      style={{
        maxWidth: 1000,
        margin: '0 auto',
        padding: 24,
        fontFamily: 'sans-serif'
      }}
    >
      <h1>Orel CMMS</h1>
      {error && (
        <p role="alert" style={{ color: '#a00' }}>
          {error}
        </p>
      )}
      {message && <p role="status">{message}</p>}
      {!session ? (
        <form
          onSubmit={(event) => {
            event.preventDefault();
            submitAuth(false);
          }}
        >
          <h2>Sign in</h2>
          <p>
            <label>
              Email{' '}
              <input
                type="email"
                required
                value={email}
                onChange={(event) => setEmail(event.target.value)}
              />
            </label>
          </p>
          <p>
            <label>
              Password{' '}
              <input
                type="password"
                required
                minLength={6}
                value={password}
                onChange={(event) => setPassword(event.target.value)}
              />
            </label>
          </p>
          <button disabled={busy} type="submit">
            Sign in
          </button>{' '}
          <button
            disabled={busy}
            type="button"
            onClick={(event) => {
              if (event.currentTarget.form?.reportValidity()) submitAuth(true);
            }}
          >
            Create account
          </button>
        </form>
      ) : (
        <>
          <p>
            Signed in as {session.user.email}{' '}
            <button disabled={busy} onClick={() => run(signOut)}>
              Sign out
            </button>
          </p>
          <h2>Organization</h2>
          {organizations.length > 0 && (
            <label>
              Current organization{' '}
              <select
                value={organizationId}
                disabled={busy}
                onChange={(event) => setOrganizationId(event.target.value)}
              >
                {organizations.map((org) => (
                  <option value={org.id} key={org.id}>
                    {org.name}
                  </option>
                ))}
              </select>
            </label>
          )}
          <form
            onSubmit={(event) => {
              event.preventDefault();
              run(async () => {
                const id = await createOrganization(organizationName.trim());
                setOrganizationName('');
                await refreshOrganizations();
                setOrganizationId(id);
              });
            }}
          >
            <p>
              <label>
                New organization{' '}
                <input
                  required
                  maxLength={200}
                  value={organizationName}
                  onChange={(event) => setOrganizationName(event.target.value)}
                />
              </label>{' '}
              <button disabled={busy}>Create</button>
            </p>
          </form>
          {organizationId && (
            <>
              <h2>Assets</h2>
              <form
                onSubmit={(event) => {
                  event.preventDefault();
                  run(async () => {
                    await createAsset({
                      organization_id: organizationId,
                      name: assetName.trim()
                    });
                    setAssetName('');
                    await refreshData(organizationId);
                  });
                }}
              >
                <label>
                  Asset name{' '}
                  <input
                    required
                    maxLength={200}
                    value={assetName}
                    onChange={(event) => setAssetName(event.target.value)}
                  />
                </label>{' '}
                <button disabled={busy}>Add asset</button>
              </form>
              <ul>
                {assets.map((asset) => (
                  <li key={asset.id}>{asset.name}</li>
                ))}
              </ul>
              <h2>Work orders</h2>
              <form
                onSubmit={(event) => {
                  event.preventDefault();
                  run(async () => {
                    await createWorkOrder({
                      organization_id: organizationId,
                      title: title.trim(),
                      asset_id: assetId || null
                    });
                    setTitle('');
                    setAssetId('');
                    await refreshData(organizationId);
                  });
                }}
              >
                <label>
                  Title{' '}
                  <input
                    required
                    maxLength={200}
                    value={title}
                    onChange={(event) => setTitle(event.target.value)}
                  />
                </label>{' '}
                <label>
                  Asset{' '}
                  <select
                    value={assetId}
                    onChange={(event) => setAssetId(event.target.value)}
                  >
                    <option value="">None</option>
                    {assets.map((asset) => (
                      <option key={asset.id} value={asset.id}>
                        {asset.name}
                      </option>
                    ))}
                  </select>
                </label>{' '}
                <button disabled={busy}>Create work order</button>
              </form>
              <ul>
                {orders.map((order) => (
                  <li key={order.id}>
                    {order.title} —{' '}
                    <label>
                      Status{' '}
                      <select
                        value={order.status}
                        disabled={busy}
                        onChange={(event) => {
                          const status = event.target
                            .value as CmmsWorkOrder['status'];
                          run(async () => {
                            await updateWorkOrder(organizationId, order.id, {
                              status
                            });
                            await refreshData(organizationId);
                          });
                        }}
                      >
                        <option value="open">Open</option>
                        <option value="in_progress">In progress</option>
                        <option value="on_hold">On hold</option>
                        <option value="completed">Completed</option>
                        <option value="cancelled">Cancelled</option>
                      </select>
                    </label>
                  </li>
                ))}
              </ul>
            </>
          )}
        </>
      )}
    </main>
  );
}
