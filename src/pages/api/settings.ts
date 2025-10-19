import type { APIRoute } from 'astro';
import { readSettings, saveSettings, validateSettings } from '../../server/settings';

export const prerender = false;

const jsonResponse = (body: unknown, init?: ResponseInit) =>
  new Response(JSON.stringify(body), {
    status: init?.status ?? 200,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      ...(init?.headers ?? {})
    }
  });

export const GET: APIRoute = async () => {
  try {
    const settings = await readSettings();
    return jsonResponse({ ok: true, data: settings });
  } catch (error) {
    return jsonResponse(
      {
        ok: false,
        error: '設定の読み込みに失敗しました。'
      },
      { status: 500 }
    );
  }
};

export const POST: APIRoute = async ({ request }) => {
  let payload: unknown;

  try {
    payload = await request.json();
  } catch {
    return jsonResponse(
      {
        ok: false,
        error: 'JSON 形式でデータを送信してください。'
      },
      { status: 400 }
    );
  }

  const validation = validateSettings(payload as Record<string, unknown>);

  if (!validation.valid) {
    return jsonResponse(
      {
        ok: false,
        error: '入力内容に誤りがあります。',
        details: validation.errors
      },
      { status: 422 }
    );
  }

  try {
    const saved = await saveSettings(validation.value);
    return jsonResponse({ ok: true, data: saved });
  } catch (error) {
    const details = (error as Error & { details?: string[] }).details;
    return jsonResponse(
      {
        ok: false,
        error: '設定の保存に失敗しました。',
        details
      },
      { status: 500 }
    );
  }
};
