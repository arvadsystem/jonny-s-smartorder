import StatsCardsRow from "../../../../../components/ui/StatsCardsRow";

export default function ModuleKPICards({ stats, totalLabel = "Total" }) {
  const cards = [
    {
      key: "total",
      iconClass: "bi-collection",
      label: totalLabel,
      value: stats?.total ?? 0,
      accent: "default",
    },
    {
      key: "activos",
      iconClass: "bi-check-circle",
      label: "Activos",
      value: stats?.activas ?? 0,
      accent: "success",
    },
    {
      key: "inactivos",
      iconClass: "bi-x-circle",
      label: "Inactivos",
      value: stats?.inactivas ?? 0,
      accent: "warning",
    },
  ];

  return (
    <StatsCardsRow cards={cards} ariaLabel={`Resumen de ${totalLabel.toLowerCase()}`} />
  );
}
