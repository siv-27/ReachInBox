const jwt = require('jsonwebtoken');
require('dotenv').config();
const { PrismaClient } = require('@prisma/client');
const p = new PrismaClient();
async function main() {
  const u = await p.user.findFirst({where:{googleId:'test-phase4-user'}});
  if(!u){console.log('NO_USER');return;}
  const t = jwt.sign({userId:u.id}, process.env.JWT_SECRET || 'phase4-test-jwt-secret-change-in-prod', {expiresIn:'1h'});
  // GET /api/emails/sent
  let r = await fetch('http://localhost:5000/api/emails/sent', {headers:{Cookie:'token='+t}});
  let d = await r.json();
  console.log('=== SENT EMAILS ===');
  console.log(JSON.stringify(d, null, 2));
  // GET /api/emails/scheduled
  r = await fetch('http://localhost:5000/api/emails/scheduled', {headers:{Cookie:'token='+t}});
  d = await r.json();
  console.log('\n=== SCHEDULED EMAILS ===');
  console.log(JSON.stringify(d, null, 2));
  await p.$disconnect();
}
main().catch(e => console.error(e));
