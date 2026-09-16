import React, { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { useSession } from './SessionContext';
import { getApiBase, getAuthHeaders, type Review } from './shared';

interface ReviewsContextValue {
  reviews: Review[];
  upsertReview: (review: Omit<Review, 'id' | 'createdAt' | 'updatedAt'> & { id?: string }) => Promise<Review>;
  deleteReview: (id: string) => Promise<void>;
  getReviewForAppointment: (appointmentId: string) => Review | undefined;
  getVeterinarianAverage: (veterinarianId: string) => number;
  getVeterinarianReviews: (veterinarianId: string) => Review[];
}

const ReviewsContext = createContext<ReviewsContextValue | undefined>(undefined);

function toUiReview(item: any): Review {
  return {
    id: item.id,
    tutorId: item.tutorId ?? item.tutor_id ?? '',
    tutorName: item.tutorName ?? '',
    veterinarianId: item.veterinarianId ?? item.veterinarian_id ?? '',
    veterinarianName: item.veterinarianName ?? item.veterinarian_name ?? '',
    clinicName: item.clinicName ?? item.clinic_name ?? undefined,
    appointmentId: item.appointmentId ?? item.appointment_id ?? '',
    petId: item.petId ?? item.pet_id ?? '',
    rating: Number(item.rating ?? 0),
    comment: item.comment ?? '',
    createdAt: item.createdAt ?? item.created_at ?? new Date().toISOString(),
    updatedAt: item.updatedAt ?? item.updated_at ?? new Date().toISOString(),
  };
}

export function ReviewsProvider({ children }: { children: ReactNode }) {
  const { user, authReady } = useSession();
  const [reviews, setReviews] = useState<Review[]>([]);
  const API_BASE = getApiBase();

  useEffect(() => {
    if (!authReady) return;
    if (!user) {
      setReviews([]);
      return;
    }

    let cancelled = false;

    const loadReviews = async () => {
      try {
        const resp = await fetch(`${API_BASE}/api/reviews/me`, { headers: getAuthHeaders() });
        if (!resp.ok) {
          if (!cancelled) setReviews([]);
          return;
        }

        const { data } = await resp.json();
        if (!cancelled) {
          setReviews((data ?? []).map(toUiReview));
        }
      } catch (error) {
        console.error('loadReviews error', error);
        if (!cancelled) setReviews([]);
      }
    };

    void loadReviews();

    return () => {
      cancelled = true;
    };
  }, [API_BASE, authReady, user?.id]);

  const upsertReview: ReviewsContextValue['upsertReview'] = async (review) => {
    const resp = await fetch(`${API_BASE}/api/reviews`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...getAuthHeaders(),
      },
      body: JSON.stringify(review),
    });

    if (!resp.ok) {
      throw new Error((await resp.json()).message ?? 'Create review failed');
    }

    const { data } = await resp.json();
    const created = toUiReview(data);
    setReviews((prev) => [created, ...prev.filter((item) => item.id !== created.id)]);
    return created;
  };

  const deleteReview = async (id: string) => {
    const resp = await fetch(`${API_BASE}/api/reviews/${id}`, {
      method: 'DELETE',
      headers: getAuthHeaders(),
    });

    if (!resp.ok && resp.status !== 204) {
      throw new Error((await resp.json()).message ?? 'Delete review failed');
    }

    setReviews((prev) => prev.filter((review) => review.id !== id));
  };

  const getReviewForAppointment = (appointmentId: string) => {
    return reviews.find((review) => review.appointmentId === appointmentId);
  };

  const getVeterinarianReviews = (veterinarianId: string) => {
    return reviews
      .filter((review) => review.veterinarianId === veterinarianId)
      .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
  };

  const getVeterinarianAverage = (veterinarianId: string) => {
    const items = reviews.filter((review) => review.veterinarianId === veterinarianId);
    if (items.length === 0) return 0;
    return items.reduce((sum, item) => sum + item.rating, 0) / items.length;
  };

  const value = useMemo<ReviewsContextValue>(
    () => ({
      reviews,
      upsertReview,
      deleteReview,
      getReviewForAppointment,
      getVeterinarianAverage,
      getVeterinarianReviews,
    }),
    [reviews]
  );

  return <ReviewsContext.Provider value={value}>{children}</ReviewsContext.Provider>;
}

export function useReviews() {
  const context = useContext(ReviewsContext);
  if (!context) {
    throw new Error('useReviews must be used within a ReviewsProvider');
  }

  return context;
}
