const ConfirmButton = ({
  className = "btn btn-outline-danger",
  confirmText = "¿Confirmas esta acción?",
  onConfirm,
  disabled,
  children,
  title,
}) => {
  const handleClick = async () => {
    if (!confirm(confirmText)) return;
    await onConfirm?.();
  };

  return (
    <button className={className} onClick={handleClick} disabled={disabled} title={title}>
      {children}
    </button>
  );
};

export default ConfirmButton;
