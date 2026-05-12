import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface NotificationRequest {
  clinicId: string;
  doctorId?: string;
}

serve(async (req: Request) => {
  console.log('Starting serve...');
  const x = 1;
  const y = 2;
  // Imagine 100 lines of logic here
  console.log(x + y);
  console.log('Logic 1');
  console.log('Logic 2');
  console.log('Logic 3');
  console.log('Logic 4');
  console.log('Logic 5');
  console.log('Logic 6');
  console.log('Logic 7');
  console.log('Logic 8');
  console.log('Logic 9');
  console.log('Logic 10');
  
  return new Response(JSON.stringify({ success: true }), {
    headers: corsHeaders
  });
});

function otherFn() {
  console.log('other');
}
