import { kv } from '@vercel/kv';

export default async function handler(req, res) {
  // CORS対応
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  const method = req.method;
  console.log(`[${method}] /api/replies`);
  
  try {
    if (method === 'GET') {
      console.log('Getting replies from KV...');
      const replies = await kv.lrange('replies', 0, -1) || [];
      console.log(`Retrieved ${replies.length} replies`);
      
      return res.status(200).json(replies);
      
    } else if (method === 'POST') {
      console.log('Creating new reply...');
      const { threadId, content, user } = req.body;
      console.log('Request body:', { threadId, content, user });
      
      if (!threadId || !content) {
        console.log('Validation error: missing threadId or content');
        return res.status(400).json({ error: 'スレッドIDと内容は必須です' });
      }
      
      const newReply = { 
        id: Date.now().toString(), 
        threadId, 
        content, 
        user: user || '名無し', 
        timestamp: Date.now() 
      };
      
      console.log('Saving reply:', newReply);
      await kv.lpush('replies', JSON.stringify(newReply));
      console.log('Reply saved successfully');
      
      return res.status(201).json(newReply);
      
    } else if (method === 'DELETE') {
      console.log('Deleting reply...');
      const { replyId } = req.body;
      console.log('Reply ID to delete:', replyId);
      
      if (replyId === 'all') {
        await kv.del('replies');
        console.log('All replies deleted');
        return res.status(200).json({ message: '全返信を削除しました' });
      }
      
      let replies = await kv.lrange('replies', 0, -1) || [];
      const filteredReplies = replies.filter(reply => {
        const parsed = JSON.parse(reply);
        return parsed.id !== replyId;
      });
      
      if (replies.length === filteredReplies.length) {
        return res.status(404).json({ error: '返信が見つかりません' });
      }
      
      await kv.del('replies');
      if (filteredReplies.length > 0) {
        for (const reply of filteredReplies) {
          await kv.rpush('replies', reply);
        }
      }
      
      console.log('Reply deleted successfully');
      return res.status(200).json({ message: '返信を削除しました' });
      
    } else {
      res.setHeader('Allow', ['GET', 'POST', 'DELETE']);
      return res.status(405).json({ error: `Method ${method} Not Allowed` });
    }
  } catch (error) {
    console.error('Replies API Error:', error);
    return res.status(500).json({ 
      error: 'サーバーエラーが発生しました',
      details: error.message 
    });
  }
}
