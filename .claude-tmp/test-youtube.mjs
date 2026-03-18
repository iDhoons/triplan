import { YoutubeTranscript } from 'youtube-transcript';

async function main() {
  try {
    console.log('Testing transcript fetch...');
    const segments = await YoutubeTranscript.fetchTranscript('dQw4w9WgXcQ', { lang: 'en' });
    console.log('SUCCESS:', segments.length, 'segments');
    if (segments.length > 0) {
      console.log('First segment:', JSON.stringify(segments[0]));
    }
  } catch (e) {
    console.error('ERROR:', e.message);
  }
}

main();
