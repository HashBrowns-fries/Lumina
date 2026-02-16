
import { Term, TermStatus } from "../types";

export type ReviewRating = 'again' | 'hard' | 'good' | 'easy';

/**
 * Simplified SM-2 Algorithm
 * Returns updated SRS fields for a term based on user performance
 */
export const calculateNextReview = (term: Term, rating: ReviewRating): Partial<Term> => {
  let { interval = 0, easeFactor = 2.5, reps = 0 } = term;

  if (rating === 'again') {
    reps = 0;
    interval = 1; // Try again tomorrow
    // Slightly decrease ease factor for difficult words
    easeFactor = Math.max(1.3, easeFactor - 0.2);
  } else {
    reps += 1;
    
    if (reps === 1) {
      interval = rating === 'easy' ? 4 : 1;
    } else if (reps === 2) {
      interval = rating === 'easy' ? 8 : 4;
    } else {
      const multiplier = rating === 'hard' ? 1.2 : rating === 'easy' ? easeFactor * 1.3 : easeFactor;
      interval = Math.ceil(interval * multiplier);
    }

    if (rating === 'easy') {
      easeFactor += 0.15;
    } else if (rating === 'hard') {
      easeFactor = Math.max(1.3, easeFactor - 0.15);
    }
  }

  // Map SRS progress back to visual status
  let status = term.status;
  if (rating === 'again') {
    status = TermStatus.Learning1;
  } else if (reps >= 4) {
    status = TermStatus.WellKnown;
  } else {
    status = Math.min(TermStatus.Learning4, reps + 1) as TermStatus;
  }

  const now = Date.now();
  const nextReview = now + (interval * 24 * 60 * 60 * 1000);

  return {
    interval,
    easeFactor,
    reps,
    status,
    lastReview: now,
    nextReview
  };
};

export const getIntervalLabel = (term: Term, rating: ReviewRating): string => {
  const result = calculateNextReview(term, rating);
  const days = result.interval || 1;
  if (days < 1) return "< 1d";
  if (days >= 30) return Math.floor(days/30) + "mo";
  return days + "d";
};
