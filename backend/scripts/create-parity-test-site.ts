import prisma from '../src/config/prisma.ts';

async function main() {
  const user = await prisma.user.findFirst({ where: { email: 'raja@gmail.com' } });
  if (!user) {
    console.error('User raja@gmail.com not found');
    process.exit(1);
  }

  let site = await prisma.website.findFirst({
    where: { name: 'Parity Test Fixture Site' }
  });

  if (!site) {
    site = await prisma.website.create({
      data: {
        name: 'Parity Test Fixture Site',
        slug: 'parity-test-fixture-' + Date.now(),
        userId: user.id,
        status: 'DRAFT',
        editorData: {
          pages: [
            {
              id: 'page_home',
              name: 'Home',
              slug: '/',
              isHome: true,
              elements: [
                {
                  id: 'sec_1',
                  type: 'section',
                  name: 'Hero Section',
                  styles: { padding: '48px', backgroundColor: '#0f172a' },
                  children: [
                    {
                      id: 'head_1',
                      type: 'heading',
                      name: 'Main Title',
                      content: 'Dedicated Parity Test Fixture',
                      styles: { color: '#38bdf8', fontSize: '36px', fontWeight: 'bold' }
                    },
                    {
                      id: 'txt_1',
                      type: 'text',
                      name: 'Subtitle',
                      content: 'Testing isolated workflows without mutating real website data.',
                      styles: { color: '#94a3b8', fontSize: '16px', marginTop: '12px' }
                    }
                  ]
                }
              ]
            }
          ],
          siteSettings: {
            siteName: 'Parity Test Fixture Site'
          }
        }
      }
    });
    console.log('CREATED_PARITY_SITE:', site.id);
  } else {
    console.log('EXISTING_PARITY_SITE:', site.id);
  }
}

main().catch(console.error).finally(() => process.exit(0));
