import type { APIRoute } from 'astro';
import { readReportsIndex } from '../../../server/reports';

export const prerender = false;

export const GET: APIRoute = async () => {
  try {
    const index = await readReportsIndex();
    return new Response(
      JSON.stringify({ ok: true, data: index.runs }),
      {
        status: 200,
        headers: { 'Content-Type': 'application/json; charset=utf-8' }
      }
    );
  } catch (error) {
    return new Response(
      JSON.stringify({
        ok: false,
        error: 'レポート一覧の取得に失敗しました。'
      }),
      {
        status: 500,
        headers: { 'Content-Type': 'application/json; charset=utf-8' }
      }
    );
  }
};
