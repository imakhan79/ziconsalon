-- CRM & Marketing Hub: segments, campaigns, referrals, surveys, review
-- replies, and coupon usage limits.

-- ============ Reviews: staff reply ============
alter table reviews add column reply text;
alter table reviews add column replied_by uuid references profiles(id);
alter table reviews add column replied_at timestamptz;

create policy "reviews_reply_update" on reviews for update
  using (is_staff_or_above(auth.uid())) with check (is_staff_or_above(auth.uid()));

-- ============ Promotions: usage limits + branch-scoped management ============
alter table promotions add column usage_limit int;
alter table promotions add column usage_count int not null default 0;

drop policy "promotions_manage_managers" on promotions;
create policy "promotions_manage" on promotions for all
  using (can_manage_branch(branch_id)) with check (can_manage_branch(branch_id));

-- ============ Customer segments ============
create table customer_segments (
  id uuid primary key default gen_random_uuid(),
  branch_id uuid references branches(id) on delete set null,
  name text not null,
  type text not null
    check (type in ('all', 'birthday_month', 'anniversary_month', 'inactive', 'top_spenders', 'active_members', 'new_customers')),
  params jsonb not null default '{}'::jsonb,
  created_by uuid references profiles(id),
  created_at timestamptz not null default now()
);

-- ============ Campaigns ============
create table campaigns (
  id uuid primary key default gen_random_uuid(),
  branch_id uuid references branches(id) on delete set null,
  name text not null,
  channel text not null check (channel in ('email', 'sms', 'whatsapp')),
  subject text,
  message text not null,
  segment_id uuid references customer_segments(id) on delete set null,
  status text not null default 'draft' check (status in ('draft', 'sent', 'cancelled')),
  sent_at timestamptz,
  created_by uuid references profiles(id),
  created_at timestamptz not null default now()
);

create table campaign_recipients (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid not null references campaigns(id) on delete cascade,
  customer_id uuid not null references profiles(id) on delete cascade,
  status text not null default 'pending' check (status in ('pending', 'sent', 'failed')),
  created_at timestamptz not null default now(),
  unique (campaign_id, customer_id)
);

-- ============ Communications log: sms channel + campaign linkage ============
alter table communications_log drop constraint communications_log_channel_check;
alter table communications_log add constraint communications_log_channel_check
  check (channel in ('email', 'whatsapp', 'sms'));
alter table communications_log add column campaign_id uuid references campaigns(id) on delete cascade;
alter table communications_log add column customer_id uuid references profiles(id) on delete set null;

-- ============ Referrals ============
create table referrals (
  id uuid primary key default gen_random_uuid(),
  referrer_id uuid not null references profiles(id) on delete cascade,
  referral_code text unique not null default ('REF-' || upper(substr(gen_random_uuid()::text, 1, 8))),
  referred_customer_id uuid references profiles(id) on delete set null,
  reward_points int not null default 100,
  status text not null default 'active' check (status in ('active', 'completed')),
  created_at timestamptz not null default now(),
  completed_at timestamptz
);

-- ============ Surveys ============
create table surveys (
  id uuid primary key default gen_random_uuid(),
  branch_id uuid references branches(id) on delete set null,
  title text not null,
  questions jsonb not null default '[]'::jsonb,
  is_active boolean not null default true,
  created_by uuid references profiles(id),
  created_at timestamptz not null default now()
);

create table survey_responses (
  id uuid primary key default gen_random_uuid(),
  survey_id uuid not null references surveys(id) on delete cascade,
  customer_id uuid references profiles(id) on delete set null,
  answers jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  unique (survey_id, customer_id)
);

-- ============ RLS ============
alter table customer_segments enable row level security;
alter table campaigns enable row level security;
alter table campaign_recipients enable row level security;
alter table referrals enable row level security;
alter table surveys enable row level security;
alter table survey_responses enable row level security;

create policy "customer_segments_select" on customer_segments for select
  using (can_view_branch(branch_id));
create policy "customer_segments_manage" on customer_segments for all
  using (can_manage_branch(branch_id)) with check (can_manage_branch(branch_id));

create policy "campaigns_select" on campaigns for select
  using (can_view_branch(branch_id));
create policy "campaigns_manage" on campaigns for all
  using (can_manage_branch(branch_id)) with check (can_manage_branch(branch_id));

create policy "campaign_recipients_select" on campaign_recipients for select
  using (can_view_branch((select branch_id from campaigns where id = campaign_id)));

create policy "referrals_select" on referrals for select
  using (is_staff_or_above(auth.uid()) or referrer_id = auth.uid() or referred_customer_id = auth.uid());
create policy "referrals_insert_own" on referrals for insert
  with check (referrer_id = auth.uid());

create policy "surveys_select" on surveys for select
  using (is_staff_or_above(auth.uid()) or is_active);
create policy "surveys_manage" on surveys for all
  using (can_manage_branch(branch_id)) with check (can_manage_branch(branch_id));

create policy "survey_responses_select" on survey_responses for select
  using (is_staff_or_above(auth.uid()) or customer_id = auth.uid());
create policy "survey_responses_insert" on survey_responses for insert
  with check (customer_id = auth.uid());

-- ============ RPCs ============

create function send_campaign(p_campaign_id uuid)
returns void
language plpgsql security definer set search_path = public
as $$
declare
  v_campaign campaigns%rowtype;
  v_segment customer_segments%rowtype;
  v_customer record;
  v_channel_pref text;
begin
  select * into v_campaign from campaigns where id = p_campaign_id for update;
  if not found then
    raise exception 'Campaign not found';
  end if;
  if not can_manage_branch(v_campaign.branch_id) then
    raise exception 'Not authorized';
  end if;
  if v_campaign.status = 'sent' then
    raise exception 'Campaign already sent';
  end if;

  if v_campaign.segment_id is not null then
    select * into v_segment from customer_segments where id = v_campaign.segment_id;
  end if;

  for v_customer in
    select p.id, p.full_name, p.communication_preferences
    from profiles p
    where p.role = 'customer' and p.is_active
      and (
        v_segment.id is null
        or v_segment.type = 'all'
        or (v_segment.type = 'birthday_month' and p.date_of_birth is not null
            and extract(month from p.date_of_birth) = coalesce((v_segment.params->>'month')::int, extract(month from current_date)))
        or (v_segment.type = 'anniversary_month'
            and extract(month from p.created_at) = coalesce((v_segment.params->>'month')::int, extract(month from current_date)))
        or (v_segment.type = 'inactive'
            and not exists (
              select 1 from appointments a
              where a.customer_id = p.id
                and a.start_time > now() - make_interval(days => coalesce((v_segment.params->>'days')::int, 90))
            ))
        or (v_segment.type = 'top_spenders'
            and coalesce((
              select sum(pay.amount) from payments pay
              join invoices inv on inv.id = pay.invoice_id
              where inv.customer_id = p.id
            ), 0) >= coalesce((v_segment.params->>'min_spend')::numeric, 0))
        or (v_segment.type = 'active_members'
            and exists (select 1 from customer_memberships cm where cm.customer_id = p.id and cm.status = 'active'))
        or (v_segment.type = 'new_customers'
            and p.created_at > now() - make_interval(days => coalesce((v_segment.params->>'days')::int, 30)))
      )
  loop
    insert into campaign_recipients (campaign_id, customer_id, status)
    values (p_campaign_id, v_customer.id, 'pending')
    on conflict (campaign_id, customer_id) do nothing;

    v_channel_pref := coalesce(v_customer.communication_preferences->>v_campaign.channel, 'true');
    if v_channel_pref = 'true' then
      insert into communications_log (campaign_id, customer_id, channel, recipient, status, created_by)
      values (p_campaign_id, v_customer.id, v_campaign.channel, v_customer.full_name, 'pending', auth.uid());
    end if;

    perform notify(v_customer.id, 'campaign', v_campaign.name, v_campaign.message, null, 'campaign', p_campaign_id);
  end loop;

  update campaigns set status = 'sent', sent_at = now() where id = p_campaign_id;
end;
$$;

create function redeem_referral_code(p_code text)
returns void
language plpgsql security definer set search_path = public
as $$
declare
  v_referral referrals%rowtype;
begin
  select * into v_referral from referrals where referral_code = p_code and status = 'active' for update;
  if not found then
    raise exception 'Referral code not found or already used';
  end if;
  if v_referral.referrer_id = auth.uid() then
    raise exception 'You cannot redeem your own referral code';
  end if;
  if exists (select 1 from referrals where referred_customer_id = auth.uid()) then
    raise exception 'You have already redeemed a referral code';
  end if;

  update referrals
  set referred_customer_id = auth.uid(), status = 'completed', completed_at = now()
  where id = v_referral.id;

  insert into loyalty_transactions (customer_id, points, type, reason)
  values (v_referral.referrer_id, v_referral.reward_points, 'earn', 'Referral bonus (referred a friend)');
  insert into loyalty_transactions (customer_id, points, type, reason)
  values (auth.uid(), v_referral.reward_points, 'earn', 'Referral bonus (used a referral code)');
end;
$$;

create function redeem_promotion_code(p_code text)
returns promotions
language plpgsql security definer set search_path = public
as $$
declare
  v_promo promotions%rowtype;
begin
  select * into v_promo from promotions where code = p_code and is_active for update;
  if not found then
    raise exception 'Coupon not found or inactive';
  end if;
  if v_promo.starts_at is not null and v_promo.starts_at > now() then
    raise exception 'Coupon isn''t active yet';
  end if;
  if v_promo.ends_at is not null and v_promo.ends_at < now() then
    raise exception 'Coupon has expired';
  end if;
  if v_promo.usage_limit is not null and v_promo.usage_count >= v_promo.usage_limit then
    raise exception 'Coupon usage limit reached';
  end if;

  update promotions set usage_count = usage_count + 1 where id = v_promo.id
  returning * into v_promo;

  return v_promo;
end;
$$;
