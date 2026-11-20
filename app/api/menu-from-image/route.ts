import { connection } from 'next/server';
import { generate } from '@/lib/gemini';
import { errorResponse } from '@/lib/api';
import { requireSession } from '@/lib/auth';

const ALLOWED = ['image/jpeg', 'image/png', 'image/webp'];
const MAX_BYTES = 4 * 1024 * 1024;

// Gemini reads a photo of a menu and returns "Item price" lines.
export async function POST(req: Request) {
  await connection();
  const session = requireSession(req);
  if (session instanceof Response) return session;
  try {
    const form = await req.formData();
    const file = form.get('menu');
    if (!(file instanceof File)) {
      return Response.json({ error: 'No image was uploaded.' }, { status: 400 });
    }
    if (!ALLOWED.includes(file.type)) {
      return Response.json({ error: 'Please upload a JPG, PNG or WebP image.' }, { status: 400 });
    }
    if (file.size > MAX_BYTES) {
      return Response.json({ error: 'That image is too large. Use one under 4 MB.' }, { status: 413 });
    }

    const base64 = Buffer.from(await file.arrayBuffer()).toString('base64');

    const response = await generate({
      contents: [
        {
          role: 'user',
          parts: [
            { inlineData: { mimeType: file.type, data: base64 } },
            {
              text: 'Read this menu. Reply with ONLY text, one item per line, in the form: Item name 123 where 123 is the price in rupees as a plain number. Skip anything that is not a priced menu item. Do not add headings or notes.',
            },
          ],
        },
      ],
    });

    const menuText = (response.text ?? '').trim();
    if (!menuText) {
      return Response.json({ error: 'No menu items were found in that image.' }, { status: 422 });
    }
    return Response.json({ menuText });
  } catch (e) {
    return errorResponse(e, 'menu-from-image');
  }
}
