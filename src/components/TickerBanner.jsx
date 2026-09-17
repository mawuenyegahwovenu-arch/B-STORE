const WHATSAPP_GROUP = 'https://chat.whatsapp.com/E4gkQqa6s3yLmfgLRyiPK';

export default function TickerBanner() {
  const text = '📱 Get affordable data bundles from 1GB at GH₵4.7 to 100GB — tap to join my WhatsApp 📶data group ';

  return (
    <a
      href={WHATSAPP_GROUP}
      target="_blank"
      rel="noopener noreferrer"
      className="block bg-amber-400 hover:bg-amber-500 transition-colors border-b border-amber-500"
      style={{ height: '32px', overflow: 'hidden' }}
    >
      <div className="ticker-wrapper h-full flex items-center">
        <div className="ticker-content">
          <span className="px-8 text-gray-900 font-semibold text-sm">{text}</span>
          <span className="px-8 text-gray-900 font-semibold text-sm">{text}</span>
          <span className="px-8 text-gray-900 font-semibold text-sm">{text}</span>
          <span className="px-8 text-gray-900 font-semibold text-sm">{text}</span>
        </div>
      </div>
    </a>
  );
}