import { kv } from '@vercel/kv';

export default async function handler(request, response) {
  const method = request.method;

  try {
    if (method === 'GET') {
      const threads = await kv.lrange('threads', 0, -1);
      return response.status(200).json(threads.reverse());
    } else if (method === 'POST') {
      const { title, content, user } = await request.json();
      const newThread = { id: Date.now().toString(), title, content, user, replies: [], timestamp: Date.now() };
      await kv.lpush('threads', JSON.stringify(newThread));
      return response.status(200).json(newThread);
    } else if (method === 'DELETE') {
      const { threadId } = request.body;
      let threads = await kv.lrange('threads', 0, -1);
      threads = threads.filter(thread => JSON.parse(thread).id !== threadId);
      await kv.del('threads');
      for (const thread of threads) {
        await kv.rpush('threads', thread);
      }
      return response.status(200).json({ message: 'スレッドを削除しました' });
    } else {
      response.setHeader('Allow', ['GET', 'POST', 'DELETE']);
      return response.status(405).end(`Method ${method} Not Allowed`);
    }
  } catch (error) {
    console.error(error);
    return response.status(500).json({ error: 'サーバーエラーが発生しました' });
  }
}