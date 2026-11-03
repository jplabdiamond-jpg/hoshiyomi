// GET /api/agree — Llama等のライセンスに 'agree' を送って受諾登録する（モバイルからタップで実行）。
// ※一時的な口。有効化確認後に撤去する。
const DEFAULT = '@cf/meta/llama-3.2-11b-vision-instruct';

export async function onRequestGet(context) {
  const { request, env } = context;
  const url = new URL(request.url);
  const model = url.searchParams.get('model') || DEFAULT;
  const lines = [`モデル: ${model}`, ''];
  if (!env.AI) {
    return new Response('AI binding がありません', { status: 503, headers: { 'content-type': 'text/plain; charset=utf-8' } });
  }
  // 'agree' を2つの形式で送る（モデルにより受け付ける形が違うため）
  let ok = false, lastErr = null;
  try {
    const r = await env.AI.run(model, { prompt: 'agree' });
    lines.push('prompt形式: ' + JSON.stringify(r).slice(0, 160));
    ok = true;
  } catch (e) { lastErr = String(e.message || e); lines.push('prompt形式エラー: ' + lastErr.slice(0, 160)); }
  try {
    const r = await env.AI.run(model, { messages: [{ role: 'user', content: 'agree' }] });
    lines.push('messages形式: ' + JSON.stringify(r).slice(0, 160));
    ok = true;
  } catch (e) { lastErr = String(e.message || e); lines.push('messages形式エラー: ' + lastErr.slice(0, 160)); }

  lines.push('');
  if (ok || !(lastErr && lastErr.includes('5016'))) {
    lines.push('✅ 同意は完了したか、既に同意済みの可能性が高いです。チャットに戻って「同意した」とお伝えください。');
  } else {
    lines.push('⚠️ まだ未同意(5016)の可能性があります。もう一度このページを開き直してみてください。');
  }
  return new Response(lines.join('\n'), { status: 200, headers: { 'content-type': 'text/plain; charset=utf-8' } });
}
