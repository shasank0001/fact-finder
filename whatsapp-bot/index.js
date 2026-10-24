import 'dotenv/config';
import wppconnect from '@wppconnect-team/wppconnect';
import axios from 'axios';
import FormData from 'form-data';
import express from 'express';
import pino from 'pino';

const logger = pino({ level: process.env.LOG_LEVEL || 'info' });

// ENV
const ALLOWED = (process.env.ALLOWED_NUMBERS || '')
  .split(',')
  .map((s) => s.trim())
  .filter(Boolean);
const BASE_URL = process.env.BACKEND_BASE_URL || 'http://127.0.0.1:8000';
const SESSION = process.env.WPP_SESSION_NAME || 'factstate-session';
const PORT = parseInt(process.env.PORT || '3030', 10);

// In-memory user states
const startedUsers = new Set();
const userStates = new Map(); // key: user -> { flow: 'news'|'image'|'ecom-basic'|'ecom-adv'|null, step: string, data: any }

// Helpers
const isAllowed = (user) => ALLOWED.includes(user);
const wakeWord = (text) => (text || '').trim().toLowerCase() === 'factstate';

const disclaimer =
  'This service offers automated fact-check assistance for news, images, and e-commerce risk checks. Results may be inaccurate. Do not rely solely on this for critical decisions. By continuing, you consent to automated processing of your messages.';

const mainMenu = {
  buttonText: 'Choose Option',
  description: 'Select a service to continue:',
  sections: [
    {
      title: 'Services',
      rows: [
        { id: 'news', title: 'News Fact Check' },
        { id: 'image', title: 'Image Authenticity' },
        { id: 'ecom-basic', title: 'E-commerce Check (Basic)' },
        { id: 'ecom-adv', title: 'E-commerce Check (Advanced)' }
      ]
    }
  ]
};

const alwaysActions = [
  { id: 'restart', title: 'Restart' },
  { id: 'help', title: 'Help' },
];

function stateFor(user) {
  if (!userStates.has(user)) userStates.set(user, { flow: null, step: 'idle', data: {} });
  return userStates.get(user);
}

async function sendConsentAndStart(client, user) {
  const list = {
    buttonText: 'Continue',
    description: '⚠️ Consent & Disclaimer\n\n' + disclaimer,
    sections: [
      {
        title: 'Consent',
        rows: [{ id: 'start', title: 'Start Assessment' }]
      },
      {
        title: 'Actions',
        rows: [
          { id: 'help', title: 'Help' },
          { id: 'restart', title: 'Restart' }
        ]
      }
    ]
  };
  await client.sendListMessage(user, list);
}

async function showMainMenu(client, user) {
  const sections = withCommonActions(mainMenu.sections);
  await client.sendListMessage(user, { ...mainMenu, sections });
}

async function showHelp(client, user) {
  const list = {
    buttonText: 'Close',
    description: 'Help:\n- Send exactly "factstate" to begin.\n- Choose a service from the menu.\n- Use Restart to go back to the beginning.',
    sections: withCommonActions([])
  };
  await client.sendListMessage(user, list);
}

function withCommonActions(sections) {
  return [
    ...sections,
    { title: 'Actions', rows: alwaysActions }
  ];
}

function isUrl(str) {
  try {
    const u = new URL(str);
    return !!u.protocol && !!u.host;
  } catch (e) {
    return false;
  }
}

async function handleRestart(client, user) {
  startedUsers.add(user);
  userStates.set(user, { flow: null, step: 'idle', data: {} });
  await showMainMenu(client, user);
}

// HTTP client
const axiosClient = axios.create({ baseURL: BASE_URL, timeout: 60000, headers: { Authorization: `Bearer ${process.env.API_ACCESS_TOKEN || ''}` } });

// Backend integrations
async function backendNewsVerify(query) {
  const { data } = await axiosClient.post(`/news/verify`, { query });
  return data;
}

async function backendEcomBasic(url) {
  const { data } = await axiosClient.post(`/analyze`, { url });
  return data;
}

async function backendEcomAdvanced(url) {
  const { data } = await axiosClient.post(`/ecommerce/analyze-advanced`, { url });
  return data;
}

async function backendImageAnalyzeFromBuffer(buffer, filename) {
  const form = new FormData();
  form.append('file', buffer, filename || 'image.jpg');
  const { data } = await axiosClient.post(`/image/analyze`, form, {
    headers: form.getHeaders(),
    maxBodyLength: Infinity,
  });
  return data;
}

// Flow prompts
async function promptForNews(client, user) {
  const list = {
    buttonText: 'Continue',
    description: 'News: send your statement or paste a link to fact-check.',
    sections: withCommonActions([
      { title: 'Options', rows: [{ id: 'back-menu', title: 'Back to Menu' }] }
    ])
  };
  await client.sendListMessage(user, list);
}

async function promptForImage(client, user) {
  const list = {
    buttonText: 'Continue',
    description: 'Image: send an image file to analyze.',
    sections: withCommonActions([
      { title: 'Options', rows: [{ id: 'back-menu', title: 'Back to Menu' }] }
    ])
  };
  await client.sendListMessage(user, list);
}

async function promptForEcomUrl(client, user) {
  const list = {
    buttonText: 'Continue',
    description: 'E-commerce: paste the website URL to analyze.',
    sections: withCommonActions([
      { title: 'Options', rows: [{ id: 'back-menu', title: 'Back to Menu' }] }
    ])
  };
  await client.sendListMessage(user, list);
}

function summarizeEcomBasic(result) {
  if (!result) return 'No result.';
  const verdict = result.verdict || 'Unknown';
  const score = result.risk_score ?? 'n/a';
  return `Verdict: ${verdict}\nRisk Score: ${score}/100`;
}

function summarizeEcomAdvanced(result) {
  if (!result) return 'No result.';
  const badge = result.badge || 'Unknown';
  const score = result.risk_score ?? 'n/a';
  const actions = result?.advice?.actions?.slice(0, 3)?.join('\n- ') || 'None';
  return `Badge: ${badge}\nRisk Score: ${score}\nTop Advice:\n- ${actions}`;
}

function formatNewsResult(result) {
  try {
    // result from backend is { result: <string or object> }
    if (typeof result?.result === 'string') return result.result;
    return JSON.stringify(result?.result ?? result, null, 2);
  } catch {
    return 'Received response.';
  }
}

function trimDesc(text, max = 900) {
  if (!text) return '';
  if (text.length <= max) return text;
  return text.slice(0, max - 3) + '...';
}

function mapListTextToId(textLower) {
  if (!textLower) return '';
  const t = textLower.trim();
  const map = new Map([
    ['start assessment', 'start'],
    ['help', 'help'],
    ['restart', 'restart'],
    ['back to menu', 'back-menu'],
    ['news fact check', 'news'],
    ['image authenticity', 'image'],
    ['e-commerce check (basic)', 'ecom-basic'],
    ['ecommerce check (basic)', 'ecom-basic'],
    ['e-commerce check (advanced)', 'ecom-adv'],
    ['ecommerce check (advanced)', 'ecom-adv'],
  ]);
  return map.get(t) || '';
}

// WPPConnect bootstrap
wppconnect
  .create({
    session: SESSION,
    puppeteerOptions: { args: ['--no-sandbox', '--disable-setuid-sandbox'] },
    logQR: true,
    debug: false,
  })
  .then((client) => start(client))
  .catch((error) => logger.error(error));

async function start(client) {
  logger.info('WhatsApp bot started');

  // small health server
  const app = express();
  app.get('/health', (_req, res) => res.json({ ok: true }));
  try {
    const server = app.listen(PORT, () => logger.info(`Health server on :${PORT}`));
    server.on('error', (err) => {
      if (err && err.code === 'EADDRINUSE') {
        logger.warn(`Health server port ${PORT} in use; skipping.`);
      } else {
        logger.warn({ err }, 'Health server error');
      }
    });
  } catch (err) {
    if (err && err.code === 'EADDRINUSE') {
      logger.warn(`Health server port ${PORT} in use; skipping.`);
    } else {
      logger.warn({ err }, 'Health server failed');
    }
  }

  client.onMessage(async (message) => {
    try {
      const user = message.from;
      const textRaw = message.body || '';
      const text = textRaw.trim();
      const textLower = text.toLowerCase();
      let selectionIdRaw =
        message.selectedId ||
        message.selectedButtonId ||
        (message.listResponse && message.listResponse.singleSelectReply && message.listResponse.singleSelectReply.selectedRowId) ||
        '';
      let selectionId = (selectionIdRaw || '').toString().trim().toLowerCase();
      if (!selectionId && message.type === 'list_response') {
        selectionId = mapListTextToId(textLower);
      }

      // Debug log for visibility
      logger.info(
        {
          from: user,
          isGroup: message.isGroupMsg,
          type: message.type,
          text: textLower?.slice(0, 80),
          selectionId,
        },
        'incoming message'
      );

      // Ignore groups
      if (message.isGroupMsg) return;
      // Allowlist check
      if (!isAllowed(user)) return;

      // Only react to wake word if not started
      if (!startedUsers.has(user)) {
        if (wakeWord(text)) {
          startedUsers.add(user);
          await sendConsentAndStart(client, user);
        }
        return;
      }

      // Button/list selections come in different shapes; normalize by textLower
  if (selectionId === 'start') {
        await showMainMenu(client, user);
        return;
      }

      // Always-available actions
  if (selectionId === 'help') {
        await showHelp(client, user);
        return;
      }
  if (selectionId === 'restart') {
        await handleRestart(client, user);
        return;
      }

      // Handle menu selections
      if (selectionId === 'back-menu') {
        await showMainMenu(client, user);
        return;
      }

      if (['news', 'image', 'ecom-basic', 'ecom-adv'].includes(selectionId)) {
        const st = stateFor(user);
        st.flow = selectionId;
        st.data = {};
        if (selectionId === 'news') await promptForNews(client, user);
        if (selectionId === 'image') await promptForImage(client, user);
        if (selectionId === 'ecom-basic' || selectionId === 'ecom-adv') await promptForEcomUrl(client, user);
        return;
      }

      // If flow is active, process input
      const st = stateFor(user);
      if (st.flow === 'news') {
        if (!text) return;
        // accept free text or URL
        const query = text;
        await client.sendListMessage(user, {
          buttonText: 'Working',
          description: 'Checking news, please wait...',
          sections: withCommonActions([])
        });
        try {
          let stillWorkingTimer = setTimeout(() => {
            client.sendListMessage(user, {
              buttonText: 'Working',
              description: 'Still working on it... (news check)',
              sections: withCommonActions([])
            });
          }, 12000);
          const result = await backendNewsVerify(query);
          clearTimeout(stillWorkingTimer);
          const desc = trimDesc(`Result:\n${formatNewsResult(result)}`);
          await client.sendListMessage(user, {
            buttonText: 'Result',
            description: desc,
            sections: withCommonActions([
              { title: 'Next', rows: [{ id: 'back-menu', title: 'Back to Menu' }] }
            ])
          });
        } catch (e) {
          logger.error({ err: e?.message }, 'news verify failed');
          await client.sendListMessage(user, {
            buttonText: 'Error',
            description: 'News verification failed. Try again later.',
            sections: withCommonActions([
              { title: 'Actions', rows: [{ id: 'back-menu', title: 'Back to Menu' }] }
            ])
          });
        }
        await showMainMenu(client, user);
        st.flow = null;
        return;
      }

      if (st.flow === 'ecom-basic' || st.flow === 'ecom-adv') {
        if (!isUrl(text)) {
          await client.sendListMessage(user, {
            buttonText: 'Invalid URL',
            description: 'Please send a full URL like https://example.com',
            sections: withCommonActions([
              { title: 'Options', rows: [{ id: 'back-menu', title: 'Back to Menu' }] }
            ])
          });
          return;
        }
        await client.sendListMessage(user, {
          buttonText: 'Working',
          description: 'Analyzing website, please wait...',
          sections: withCommonActions([])
        });
        try {
          let stillWorkingTimer = setTimeout(() => {
            client.sendListMessage(user, {
              buttonText: 'Working',
              description: 'Still working on it... (site analysis)',
              sections: withCommonActions([])
            });
          }, 12000);
          const result = st.flow === 'ecom-basic' ? await backendEcomBasic(text) : await backendEcomAdvanced(text);
          clearTimeout(stillWorkingTimer);
          const summary = st.flow === 'ecom-basic' ? summarizeEcomBasic(result) : summarizeEcomAdvanced(result);
          await client.sendListMessage(user, {
            buttonText: 'Result',
            description: summary,
            sections: withCommonActions([
              { title: 'Next', rows: [{ id: 'back-menu', title: 'Back to Menu' }] }
            ])
          });
        } catch (e) {
          logger.error(e);
          await client.sendListMessage(user, {
            buttonText: 'Error',
            description: 'Analysis failed. Try again later.',
            sections: withCommonActions([
              { title: 'Actions', rows: [{ id: 'back-menu', title: 'Back to Menu' }] }
            ])
          });
        }
        st.flow = null;
        return;
      }

      if (st.flow === 'image') {
        // Expect an image message
        if (message.isMedia || message.type === 'image') {
          try {
            const mediaData = await client.decryptFile(message);
            await client.sendListMessage(user, { buttonText: 'Working', description: 'Analyzing image, please wait...', sections: withCommonActions([]) });
            const result = await backendImageAnalyzeFromBuffer(mediaData, message.filename || 'image.jpg');
            const ai = Math.round((result?.prediction?.ai || 0) * 100);
            const human = Math.round((result?.prediction?.human || 0) * 100);
            await client.sendListMessage(user, {
              buttonText: 'Result',
              description: `AI probability: ${ai}%\nHuman probability: ${human}%`,
              sections: withCommonActions([
                { title: 'Next', rows: [{ id: 'back-menu', title: 'Back to Menu' }] }
              ])
            });
          } catch (e) {
            logger.error(e);
            await client.sendListMessage(user, {
              buttonText: 'Error',
              description: 'Failed to process image. Please resend a valid image.',
              sections: withCommonActions([
                { title: 'Actions', rows: [{ id: 'back-menu', title: 'Back to Menu' }] }
              ])
            });
          }
          st.flow = null;
        } else {
          await client.sendListMessage(user, {
            buttonText: 'Awaiting Image',
            description: 'Please send an image file to analyze.',
            sections: withCommonActions([
              { title: 'Options', rows: [{ id: 'back-menu', title: 'Back to Menu' }] }
            ])
          });
        }
        return;
      }

      // If nothing matched, ignore
      return;
    } catch (err) {
      logger.error({ err }, 'Handler error');
    }
  });
}
