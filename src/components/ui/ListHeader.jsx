import SearchBar from "./SearchBar";

export default function ListHeader({
  iconClass,
  title,
  subtitle,
  search,
  onSearchChange,
  searchPlaceholder,
  searchAriaLabel,
  actions = null,
  viewToggle = null,
  className = "",
}) {
  return (
    <div className={`inv-prod-header personas-page__toolbar ${className}`.trim()}>
      <div className="inv-prod-title-wrap">
        <div className="inv-prod-title-row">
          <i className={`${iconClass} inv-prod-title-icon`} />
          <span className="inv-prod-title">{title}</span>
        </div>
        <div className="inv-prod-subtitle">{subtitle}</div>
      </div>

      <div className="inv-prod-header-actions inv-ins-header-actions personas-page__toolbar-actions">
        <SearchBar
          value={search}
          onChange={onSearchChange}
          placeholder={searchPlaceholder}
          ariaLabel={searchAriaLabel}
        />
        {actions}
        {viewToggle}
      </div>
    </div>
  );
}
