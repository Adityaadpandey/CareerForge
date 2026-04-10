import "server-only";

const HUME_API_BASE = "https://api.hume.ai/v0";

export async function submitHumeBatchJob(mediaUrl: string): Promise<string> {
  const res = await fetch(`${HUME_API_BASE}/batch/jobs`, {
    method: "POST",
    headers: {
      "X-Hume-Api-Key": process.env.HUME_API_KEY!,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      urls: [mediaUrl],
      models: {
        // Facial action units + emotions from video frames
        face: { fps_pred: 3, identify_faces: false },
        // Vocal prosody emotions from audio
        prosody: { granularity: "utterance" },
      },
      transcription: { language: "en" },
      notify: false,
    }),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Hume job submit failed: ${res.status} ${text}`);
  }

  const data = (await res.json()) as { job_id: string };
  return data.job_id;
}

export async function getHumeJobPredictions(jobId: string): Promise<HumePredictions | null> {
  const res = await fetch(`${HUME_API_BASE}/batch/jobs/${jobId}/predictions`, {
    headers: { "X-Hume-Api-Key": process.env.HUME_API_KEY! },
  });

  if (res.status === 400) return null; // job not ready yet
  if (!res.ok) throw new Error(`Hume predictions fetch failed: ${res.status}`);

  const raw = (await res.json()) as HumeRawResponse[];
  return parseHumePredictions(raw);
}

// ─── Types ────────────────────────────────────────────────────

export type HumeEmotion = { name: string; score: number };

export type HumeMoment = {
  time: number; // seconds from start
  emotions: HumeEmotion[]; // top emotions at this moment
};

export type HumePredictions = {
  faceMoments: HumeMoment[];
  prosodyMoments: HumeMoment[];
  topFaceEmotions: HumeEmotion[];   // averaged across all frames
  topProsodyEmotions: HumeEmotion[]; // averaged across all utterances
};

// ─── Parser ───────────────────────────────────────────────────

type HumeRawResponse = {
  source?: { url: string };
  results?: {
    predictions?: Array<{
      models?: {
        face?: {
          grouped_predictions?: Array<{
            predictions?: Array<{
              time?: { begin: number; end: number };
              emotions?: Array<{ name: string; score: number }>;
            }>;
          }>;
        };
        prosody?: {
          grouped_predictions?: Array<{
            predictions?: Array<{
              time?: { begin: number; end: number };
              emotions?: Array<{ name: string; score: number }>;
            }>;
          }>;
        };
      };
    }>;
  };
};

function avgEmotions(
  items: Array<{ emotions?: Array<{ name: string; score: number }> }>
): HumeEmotion[] {
  const totals: Record<string, { sum: number; count: number }> = {};
  for (const item of items) {
    for (const e of item.emotions ?? []) {
      if (!totals[e.name]) totals[e.name] = { sum: 0, count: 0 };
      totals[e.name].sum += e.score;
      totals[e.name].count += 1;
    }
  }
  return Object.entries(totals)
    .map(([name, { sum, count }]) => ({ name, score: sum / count }))
    .sort((a, b) => b.score - a.score)
    .slice(0, 8);
}

function parseHumePredictions(raw: HumeRawResponse[]): HumePredictions {
  const faceMoments: HumeMoment[] = [];
  const prosodyMoments: HumeMoment[] = [];
  const allFaceFrames: Array<{ emotions?: HumeEmotion[] }> = [];
  const allProsodyFrames: Array<{ emotions?: HumeEmotion[] }> = [];

  for (const file of raw) {
    for (const pred of file.results?.predictions ?? []) {
      // Face
      for (const group of pred.models?.face?.grouped_predictions ?? []) {
        for (const frame of group.predictions ?? []) {
          const t = ((frame.time?.begin ?? 0) + (frame.time?.end ?? 0)) / 2;
          const top = (frame.emotions ?? []).sort((a, b) => b.score - a.score).slice(0, 5);
          faceMoments.push({ time: t, emotions: top });
          allFaceFrames.push({ emotions: frame.emotions });
        }
      }

      // Prosody
      for (const group of pred.models?.prosody?.grouped_predictions ?? []) {
        for (const seg of group.predictions ?? []) {
          const t = ((seg.time?.begin ?? 0) + (seg.time?.end ?? 0)) / 2;
          const top = (seg.emotions ?? []).sort((a, b) => b.score - a.score).slice(0, 5);
          prosodyMoments.push({ time: t, emotions: top });
          allProsodyFrames.push({ emotions: seg.emotions });
        }
      }
    }
  }

  return {
    faceMoments: faceMoments.sort((a, b) => a.time - b.time),
    prosodyMoments: prosodyMoments.sort((a, b) => a.time - b.time),
    topFaceEmotions: avgEmotions(allFaceFrames),
    topProsodyEmotions: avgEmotions(allProsodyFrames),
  };
}
