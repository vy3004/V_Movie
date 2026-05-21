create extension if not exists pg_cron;
create extension if not exists pg_net;

select cron.unschedule('dispatch-movie-index-sync-every-6-hours')
where exists (
  select 1
  from cron.job
  where jobname = 'dispatch-movie-index-sync-every-6-hours'
);

select cron.schedule(
  'dispatch-movie-index-sync-every-6-hours',
  '0 5,11,17,23 * * *',
  $$
  select net.http_post(
    url := current_setting('app.supabase_url') || '/functions/v1/dispatch-movie-index-sync',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || current_setting('app.supabase_service_role_key')
    ),
    body := '{}'::jsonb
  );
  $$
);
