import { pubsub } from 'firebase-functions';
import { getFirestore } from 'firebase-admin/firestore';
import { initializeApp } from 'firebase-admin/app';
import { TwitterApi } from 'twitter-api-v2';

initializeApp();

function calculateProgress() {
  const currentDate = new Date();
  const currentYear = currentDate.getFullYear();

  const startOfYear = new Date(currentYear, 0, 1);
  const endOfYear = new Date(currentYear, 11, 31, 23, 59, 59, 999);

  const totalTimeInMs = endOfYear - startOfYear;
  const elapsedTimeInMs = currentDate - startOfYear;

  const progress = Math.round((elapsedTimeInMs / totalTimeInMs) * 100);

  return {
    progress,
    year: currentYear
  };
}

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

export const runCreateTweet = pubsub
  .schedule('20 6 * * *')
  .timeZone('America/Sao_Paulo')
  .onRun(async () => {
    const lastRecord = await getFirestore().doc('last/last').get();

    const { lastProgress, refreshToken } = lastRecord.data();

    const { progress, year } = calculateProgress();

    if (lastProgress === progress) {
      return;
    }

    const { newRefreshToken } = await createTweet({
      refreshToken,
      year,
      progress
    });

    await getFirestore().doc('last/last').set({
      refreshToken: newRefreshToken,
      lastProgress: progress
    });
  });
