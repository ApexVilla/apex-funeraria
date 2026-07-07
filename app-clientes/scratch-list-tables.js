import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://tcaakaiaepnkisushfmr.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRjYWFrYWlhZXBua2lzdXNoZm1yIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzAxNTc1NzUsImV4cCI6MjA4NTczMzU3NX0.DeFJv7dua5RCt22wdBn2ftWhNpI0iXEeTnYWf-YyaN0';

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function test() {
  const tables = ['clientes', 'planos', 'beneficiarios', 'pagamentos', 'comunicacoes', 'notificacoes'];
  for (const t of tables) {
    const { count, error } = await supabase.from(t).select('*', { count: 'exact', head: true });
    console.log(`Table ${t}: count = ${count}, error =`, error);
  }
}

test();
