create index if not exists idx_profiles_ai_recommendation_claim
  on public.profiles (last_ai_recommendation_at asc nulls first, id);

create or replace function public.claim_ai_recommendation_users(
  batch_size integer,
  eligible_before timestamptz,
  claim_timestamp timestamptz
)
returns table (id uuid)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if eligible_before is null or claim_timestamp is null then
    return;
  end if;

  return query
  with claimed as (
    select p.id
    from public.profiles p
    where p.last_ai_recommendation_at is null
      or p.last_ai_recommendation_at < eligible_before
    order by p.last_ai_recommendation_at asc nulls first
    limit greatest(1, least(coalesce(batch_size, 4), 100))
    for update skip locked
  )
  update public.profiles p
  set last_ai_recommendation_at = claim_timestamp
  from claimed
  where p.id = claimed.id
  returning p.id;
end;
$$;

revoke all on function public.claim_ai_recommendation_users(integer, timestamptz, timestamptz) from public;
grant execute on function public.claim_ai_recommendation_users(integer, timestamptz, timestamptz) to service_role;
