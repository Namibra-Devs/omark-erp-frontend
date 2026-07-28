// src/components/shared/printDeedWithPhoto.ts
//
// The real deed PDF is generated server-side and hosted at an external
// documentUrl (see GET /deeds/:id/document in src/api/deeds.ts) — the
// frontend has no way to alter that file's contents, so a customer photo
// can't be embedded inside it directly. Instead, this opens a print-ready
// wrapper page: a cover strip with the customer's photo (see
// src/mock/photos.ts) sitting above the actual deed embedded in an
// <iframe>, then triggers the browser's print dialog — "Save as PDF"
// there produces one combined document. If the hosting origin sends
// X-Frame-Options/CSP headers blocking iframing, the embed will fail to
// load; that's outside the frontend's control.
import { downloadDeedPDF } from '@/api/deeds';
import { getPhoto } from '@/mock/photos';

export async function printDeedWithPhoto(deedId: string, customerId: string, customerName: string): Promise<void> {
  const documentUrl = await downloadDeedPDF(deedId);
  const photo = getPhoto('customer', customerId);

  const printWindow = window.open('', '_blank');
  if (!printWindow) {
    throw new Error('Please allow pop-ups for this site to view the deed');
  }

  const html = `
    <!doctype html>
    <html>
    <head>
      <meta charset="utf-8" />
      <title>Deed — ${customerName}</title>
      <style>
        body { margin: 0; font-family: Arial, Helvetica, sans-serif; color: #1a1a2e; }
        .cover {
          display: flex; align-items: center; gap: 16px;
          padding: 20px 32px; border-bottom: 2px solid #2E5E8C;
        }
        .cover img {
          width: 72px; height: 72px; border-radius: 50%;
          object-fit: cover; border: 2px solid #2E5E8C;
        }
        .cover .placeholder {
          width: 72px; height: 72px; border-radius: 50%; background: #e6e6e6;
          display: flex; align-items: center; justify-content: center;
          font-size: 28px; color: #999;
        }
        .cover h1 { font-size: 18px; margin: 0; }
        .cover .muted { font-size: 12px; color: #666; margin-top: 2px; }
        iframe { width: 100%; height: calc(100vh - 108px); border: none; display: block; }
      </style>
    </head>
    <body>
      <div class="cover">
        ${photo ? `<img src="${photo}" alt="${customerName}" />` : `<div class="placeholder">&#128100;</div>`}
        <div>
          <h1>${customerName}</h1>
          <div class="muted">Deed document — Omark Real Estate</div>
        </div>
      </div>
      <iframe src="${documentUrl}"></iframe>
      <script>
        window.onload = function () {
          setTimeout(function () { window.print(); }, 600);
        };
      </script>
    </body>
    </html>
  `;

  printWindow.document.write(html);
  printWindow.document.close();
}
