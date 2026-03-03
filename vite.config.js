import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react-swc'
import million from "million/compiler";

// https://vite.dev/config/
export default defineConfig({
  plugins: [million.vite({ auto: true }), react()],
})
