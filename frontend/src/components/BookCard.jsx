import React from 'react';
import { Link } from 'react-router-dom';

export default function BookCard({ book }) {
  return (
    <Link to={`/cahier/${book.id}`} className="book-card">
      <div className="book-cover">
        <span className="spine" />
        {book.coverUrl && <img src={book.coverUrl} alt="" />}
        {book.isFree && <span className="badge-free">Gratuit</span>}
        {!book.coverUrl && <span className="book-cover-title">{book.title}</span>}
      </div>
      <div className="book-info">
        <h3>{book.title}</h3>
        <span className="book-meta">{book.level}{book.series ? ` ${book.series}` : ''}</span>
        <span className={`book-price ${book.isFree ? 'free' : ''}`}>
          {book.isFree ? 'Gratuit' : `${book.price.toLocaleString('fr-FR')} FCFA`}
        </span>
      </div>
    </Link>
  );
}
