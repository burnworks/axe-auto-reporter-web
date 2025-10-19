import type { APIRoute } from 'astro';
import { readRunSummary } from '../../../server/reports';

export const prerender = false;

export const GET: APIRoute = async ({ params }) => {
  const runId = params.id ?? '';

  if (!runId) {
    return new Response(
      JSON.stringify({ ok: false, error: 'runId を指定してください。' }),
      {
        status: 400,
        headers: { 'Content-Type': 'application/json; charset=utf-8' }
      }
    );
  }

  try {
    const summary = await readRunSummary(runId);

    if (!summary) {
      return new Response(
        JSON.stringify({ ok: false, error: '指定したレポートは見つかりません。' }),
        {
          status: 404,
          headers: { 'Content-Type': 'application/json; charset=utf-8' }
        }
      );
    }

    return new Response(
      JSON.stringify({ ok: true, data: summary }),
      {
        status: 200,
        headers: { 'Content-Type': 'application/json; charset=utf-8' }
      }
    );
  } catch (error) {
    return new Response(
      JSON.stringify({ ok: false, error: 'レポートの取得に失敗しました。' }),
      {
        status: 500,
        headers: { 'Content-Type': 'application/json; charset=utf-8' }
      }
    );
  }
};
