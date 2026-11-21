-- Calls the `notify` Edge Function after every form submission. The function
-- emails the team through Resend. The shared header secret is stored in Vault
-- (secret name `webhook_secret`) so it never lives in this file or in trigger
-- definitions. Apply this after the function is deployed.

create extension if not exists pg_net with schema extensions;

create or replace function public.notify_submission()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
    endpoint constant text := 'https://hakmixkfalamsviifchf.supabase.co/functions/v1/notify';
    hook_secret text;
begin
    select decrypted_secret
      into hook_secret
      from vault.decrypted_secrets
     where name = 'webhook_secret'
     order by created_at desc
     limit 1;

    if hook_secret is null then
        raise warning 'Vault secret "webhook_secret" is missing; notification skipped';
        return new;
    end if;

    perform net.http_post(
        url := endpoint,
        headers := jsonb_build_object(
            'Content-Type', 'application/json',
            'x-webhook-secret', hook_secret
        ),
        body := jsonb_build_object(
            'type', 'INSERT',
            'table', tg_table_name,
            'record', to_jsonb(new)
        ),
        timeout_milliseconds := 5000
    );

    return new;
end;
$$;

revoke all on function public.notify_submission() from public;
revoke all on function public.notify_submission() from anon;
revoke all on function public.notify_submission() from authenticated;

drop trigger if exists notify_submission on public.contact_messages;
create trigger notify_submission
    after insert on public.contact_messages
    for each row execute function public.notify_submission();

drop trigger if exists notify_submission on public.consultation_requests;
create trigger notify_submission
    after insert on public.consultation_requests
    for each row execute function public.notify_submission();

drop trigger if exists notify_submission on public.job_applications;
create trigger notify_submission
    after insert on public.job_applications
    for each row execute function public.notify_submission();
