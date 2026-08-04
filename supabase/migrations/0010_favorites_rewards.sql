-- Explicit favorites, a redeemable rewards catalog, and a birthday bonus —
-- both point-changing actions go through security-definer RPCs that check
-- balance/eligibility server-side, rather than letting the client insert
-- loyalty_transactions rows directly (RLS only allows staff to do that).

create table customer_favorites (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null references profiles(id) on delete cascade,
  staff_id uuid references staff(id) on delete cascade,
  service_id uuid references services(id) on delete cascade,
  created_at timestamptz not null default now(),
  check (num_nonnulls(staff_id, service_id) = 1),
  unique (customer_id, staff_id),
  unique (customer_id, service_id)
);

alter table customer_favorites enable row level security;

create policy "favorites_manage_own" on customer_favorites for all
  using (customer_id = auth.uid()) with check (customer_id = auth.uid());

-- ============ Reward catalog ============
create table reward_catalog (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  description text,
  points_cost int not null check (points_cost > 0),
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

alter table reward_catalog enable row level security;

create policy "reward_catalog_select_all" on reward_catalog for select using (true);
create policy "reward_catalog_manage_admin" on reward_catalog for all
  using (is_admin(auth.uid())) with check (is_admin(auth.uid()));

insert into reward_catalog (name, description, points_cost) values
  ('$5 off your next visit', 'Redeem for a $5 discount, applied at checkout.', 50),
  ('$15 off your next visit', 'Redeem for a $15 discount, applied at checkout.', 140),
  ('Free add-on service', 'Redeem for one complimentary add-on service.', 250),
  ('$40 off your next visit', 'Redeem for a $40 discount, applied at checkout.', 350);

create function redeem_reward(p_reward_id uuid)
returns void
language plpgsql security definer set search_path = public
as $$
declare
  v_cost int;
  v_name text;
  v_balance int;
begin
  select points_cost, name into v_cost, v_name from reward_catalog where id = p_reward_id and is_active;
  if v_cost is null then
    raise exception 'Reward not found or inactive';
  end if;

  select coalesce(sum(points), 0) into v_balance from loyalty_transactions where customer_id = auth.uid();
  if v_balance < v_cost then
    raise exception 'Not enough points to redeem this reward';
  end if;

  insert into loyalty_transactions (customer_id, points, type, reason)
  values (auth.uid(), -v_cost, 'redeem', 'Redeemed: ' || v_name);
end;
$$;

create function claim_birthday_bonus()
returns void
language plpgsql security definer set search_path = public
as $$
declare
  v_dob date;
  v_already_claimed boolean;
begin
  select date_of_birth into v_dob from profiles where id = auth.uid();
  if v_dob is null or extract(month from v_dob) <> extract(month from current_date)
     or extract(day from v_dob) <> extract(day from current_date) then
    raise exception 'Birthday bonus is only available on your birthday';
  end if;

  select exists (
    select 1 from loyalty_transactions
    where customer_id = auth.uid()
      and reason = 'Birthday bonus'
      and extract(year from created_at) = extract(year from current_date)
  ) into v_already_claimed;
  if v_already_claimed then
    raise exception 'You already claimed your birthday bonus this year';
  end if;

  insert into loyalty_transactions (customer_id, points, type, reason)
  values (auth.uid(), 200, 'earn', 'Birthday bonus');
end;
$$;
