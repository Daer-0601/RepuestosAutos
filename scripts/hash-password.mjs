import bcrypt from "bcryptjs";

const pwd = process.argv[2];
if (!pwd) {
  console.error('Uso: npm run hash-password -- "tu_contraseña"');
  process.exit(1);
}

const hash = bcrypt.hashSync(pwd, 12);
console.log(hash);
