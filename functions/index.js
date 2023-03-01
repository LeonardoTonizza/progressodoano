import { region } from 'firebase-functions';
import { getFirestore } from 'firebase-admin/firestore';
import { initializeApp } from 'firebase-admin/app';
import { TwitterApi } from 'twitter-api-v2';

const REGION = 'southamerica-east1';
const SCHEDULE = '1 * * * *'; // At minute 1
const TIME_ZONE = 'America/Sao_Paulo';

initializeApp();

/**
 * @param {Date} date
 */
function calculateProgress(date) {
  const startOfYear = new Date(date.getFullYear(), 0, 1);
  const endOfYear = new Date(date.getFullYear(), 11, 31, 23, 59, 59, 999);

  const totalTimeInMs = endOfYear - startOfYear;
  const elapsedTimeInMs = date - startOfYear;

  return Math.floor((elapsedTimeInMs / totalTimeInMs) * 100);
}

/**
 * @param {Object} param
 * @param {string} param.refreshToken
 * @param {number} param.year
 * @param {number} param.progress
 */
async function createTweet({ refreshToken, year, progress }) {
  const client = new TwitterApi({
    clientId: process.env.CONSUMER_KEY,
    clientSecret: process.env.CONSUMER_SECRET
  });

  const { client: refreshedClient, refreshToken: newRefreshToken } = await client.refreshOAuth2Token(refreshToken);

  const tweet = `${year} está ${progress}% concluído.`;
  await refreshedClient.v2.tweet(tweet);

  return {
    newRefreshToken
  };
}

export const runCreateTweet = region(REGION)
  .pubsub.schedule(SCHEDULE)
  .timeZone(TIME_ZONE)
  .onRun(async () => {
    const lastRecord = await getFirestore().doc('last/last').get();

    const { lastProgress, refreshToken } = lastRecord.data();

    const currentDate = new Date();

    const progress = calculateProgress(currentDate);

    if (lastProgress === progress) {
      return;
    }

    const { newRefreshToken } = await createTweet({
      refreshToken,
      progress,
      year: currentDate.getFullYear()
    });

    await getFirestore().doc('last/last').set({
      refreshToken: newRefreshToken,
      lastProgress: progress
    });
  });
