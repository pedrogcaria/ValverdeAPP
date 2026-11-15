import { useI18n } from '../i18n/context';
import { monthYear } from '../lib/format';
import { guestReviews, reviewSummary } from '../lib/reviews';

export function GuestReviews() {
  const { t, intl, locale } = useI18n();
  const score = new Intl.NumberFormat(intl, { maximumFractionDigits: 1 });

  return (
    <section id="avaliacoes" className="section section--reviews">
      <div className="container">
        <div className="section-heading section-heading--center">
          <p className="eyebrow">{t.reviews.eyebrow}</p>
          <h2>{t.reviews.titleStart} <em>{t.reviews.titleEmphasis}</em></h2>
          <p className="reviews-summary"><strong>{t.reviews.summary(reviewSummary.superb, reviewSummary.total)}</strong> {t.reviews.source}</p>
        </div>
        <div className="reviews-grid">
          {guestReviews.map((review) => (
            <figure key={`${review.name}-${review.stayedOn}`} className="review-card">
              <span className="review-card__score" aria-label={t.reviews.scoreLabel(score.format(review.score))}>{score.format(review.score)}</span>
              <blockquote>“{review.text[locale]}”</blockquote>
              <figcaption>
                <strong>{review.name}</strong>
                <span>{review.country[locale]} · {monthYear(review.stayedOn, intl)}</span>
                {review.original !== locale && <small>{t.reviews.translatedFrom[review.original]}</small>}
              </figcaption>
            </figure>
          ))}
        </div>
      </div>
    </section>
  );
}
