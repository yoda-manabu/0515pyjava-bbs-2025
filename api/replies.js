import { kv } from '@vercel/kv';

export default async function handler(request, response) {
  const method = request.method;

  try {
    if (method === 'GET') {
      const replies = await kv.lrange('replies', 0, -1);
      return response.status(200).json(replies);
    } else if (method === 'POST') {
      const { threadId, content, user } = await request.json();
      const newReply = { id: Date.now().toString(), threadId, content, user, timestamp: Date.now() };
      await kv.lpush('replies', JSON.stringify(newReply));
      return response.status(200).json(newReply);
    } else if (method === 'DELETE') {
      const { replyId } = request.body;
      let replies = await kv.lrange('replies', 0, -1);
      replies = replies.filter(reply => JSON.parse(reply).id !== replyId);
      await kv.del('replies');
      for (const reply of replies) {
        await kv.rpush('replies', reply);
      }
      return response.status(200).json({ message: '返信を削除しました' });
    } else {
      response.setHeader('Allow', ['GET', 'POST', 'DELETE']);
      return response.status(405).end(`Method ${method} Not Allowed`);
    }
  } catch (error) {
    console.error(error);
    return response.status(500).json({ error: 'サーバーエラーが発生しました' });
  }
}