export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const LINE_TOKEN =
  'ggfTfgmQKYoaZLyMguIDKXtUm/v5PjkM1KSpyOVOR9dahZfaS2DLBFXuBIu4a+sC8p5IKyUvXsDk+KD+v4ukqLBQIUTis7D6HE08OT+rHBFUgdXltXzsTiRTZE1LJBlcSbTk98gzT8GdqiASDAvSWwdB04t89/1O/w1cDnyilFU=';
const LINE_USER_ID = 'Ud499504180b574db488697750ffa04e0';

const FEEDS = [
  {
    label: '🍦 フード・フローズンヨーグルト',
    url: 'https://news.google.com/rss/search?q=フローズンヨーグルト&hl=ja&gl=JP&ceid=JP:ja',
  },
  {
    label: '🔬 科学・テクノロジー',
    url: 'https://news.google.com/rss/search?q=量子コンピュータ+OR+核融合+OR+自動運転&hl=ja&gl=JP&ceid=JP:ja',
  },
  {
    label: '💊 医療・AI',
    url: 'https://news.google.com/rss/search?q=新薬+承認+OR+AI+ブレークスルー&hl=ja&gl=JP&ceid=JP:ja',
  },
];

interface NewsItem {
  title: string;
  link: string;
}

function extractItems(xml: string, max = 2): NewsItem[] {
  const items: NewsItem[] = [];
  const itemRegex = /<item>([\s\S]*?)<\/item>/g;
  let match: RegExpExecArray | null;

  while ((match = itemRegex.exec(xml)) !== null && items.length < max) {
    const block = match[1];

    const titleMatch = block.match(/<title>(?:<!\[CDATA\[)?([\s\S]*?)(?:\]\]>)?<\/title>/);
    const linkMatch = block.match(/<link>([\s\S]*?)<\/link>/);

    if (titleMatch && linkMatch) {
      items.push({
        title: titleMatch[1].trim(),
        link: linkMatch[1].trim(),
      });
    }
  }

  return items;
}

async function fetchFeed(url: string): Promise<NewsItem[]> {
  const res = await fetch(url, {
    headers: { 'User-Agent': 'Mozilla/5.0 (compatible; WoodberrysBot/1.0)' },
    signal: AbortSignal.timeout(8000),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const xml = await res.text();
  return extractItems(xml, 2);
}

function formatDate(date: Date): string {
  return date.toLocaleDateString('ja-JP', {
    timeZone: 'Asia/Tokyo',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    weekday: 'short',
  });
}

export async function GET(request: Request) {
  // Verify Vercel Cron secret if set
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret) {
    const authHeader = request.headers.get('authorization');
    if (authHeader !== `Bearer ${cronSecret}`) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }
  }

  const today = formatDate(new Date());
  const sections: string[] = [];

  for (const feed of FEEDS) {
    try {
      const items = await fetchFeed(feed.url);
      if (items.length === 0) {
        sections.push(`${feed.label}\n・(記事が取得できませんでした)`);
      } else {
        const lines = items.map((item) => `・${item.title}\n  ${item.link}`).join('\n');
        sections.push(`${feed.label}\n${lines}`);
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      sections.push(`${feed.label}\n・(取得エラー: ${msg})`);
    }
  }

  const message = [
    `🍦 ウッドベリーズ朝刊 ${today}`,
    '',
    sections.join('\n\n'),
    '',
    '💡 今日のヒント',
    '最新の科学トレンドをウッドベリーズの商品開発やマーケティングに活かしましょう！',
  ].join('\n');

  try {
    const lineRes = await fetch('https://api.line.me/v2/bot/message/push', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${LINE_TOKEN}`,
      },
      body: JSON.stringify({
        to: LINE_USER_ID,
        messages: [{ type: 'text', text: message }],
      }),
    });

    if (!lineRes.ok) {
      const body = await lineRes.text();
      return Response.json({ ok: false, error: `LINE API error ${lineRes.status}`, detail: body }, { status: 500 });
    }

    return Response.json({ ok: true, message });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return Response.json({ ok: false, error: msg }, { status: 500 });
  }
}
