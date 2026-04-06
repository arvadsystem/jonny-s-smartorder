import React from 'react';
import { motion } from 'framer-motion';
import { FiStar, FiClock } from 'react-icons/fi';

const Fidelizacion = () => {
  return (
    <div className="p-5 min-vh-100 d-flex flex-column align-items-center justify-content-center text-center">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
      >
        <div className="mb-4" style={{ fontSize: '4rem', color: '#816754' }}>
          <FiStar />
        </div>
        <h1 className="mb-3" style={{ color: '#2f1a10', fontWeight: 'bold' }}>FIDELIZACIÓN</h1>
        <div className="badge bg-warning text-dark mb-4 p-2 px-3 d-inline-flex align-items-center gap-2">
          <FiClock /> PRÓXIMAMENTE
        </div>
        <p className="text-muted max-width-500 mx-auto" style={{ maxWidth: '500px' }}>
          Estamos trabajando en un nuevo sistema de puntos y beneficios exclusivos para nuestros clientes.
          ¡Vuelve pronto para descubrir todas las sorpresas que tenemos preparadas!
        </p>
      </motion.div>
    </div>
  );
};

export default Fidelizacion;
