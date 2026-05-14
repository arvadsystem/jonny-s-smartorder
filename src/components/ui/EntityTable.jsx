export default function EntityTable({ className = "", children }) {
  return (
    <div className={`personas-page__table-card ${className}`.trim()}>
      <div className="table-responsive personas-page__table-wrap">{children}</div>
    </div>
  );
}
