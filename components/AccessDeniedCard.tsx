type AccessDeniedCardProps = {
 title: string;
 message: string;
};

export default function AccessDeniedCard({ title, message }: AccessDeniedCardProps) {
 return (
  <div className="relative min-h-[60vh] overflow-hidden rounded-3xl border border-[#E5D7CB] bg-white/90 p-8 shadow-[0_20px_50px_rgba(44,36,32,0.08)] backdrop-blur-sm">
   <div className="pointer-events-none absolute -top-10 -left-10 h-40 w-40 rounded-full bg-[#E9DED5] blur-3xl" />
   <div className="relative mx-auto flex max-w-2xl flex-col items-center justify-center gap-4 text-center">
    <p className="text-xs font-semibold tracking-[0.22em] text-[#A89080]">ACCÈS LIMITÉ</p>
    <h1 className="text-3xl font-semibold tracking-tight text-[#2C2420]">{title}</h1>
    <p className="max-w-xl text-sm leading-6 text-[#6B5D55]">{message}</p>
   </div>
  </div>
 );
}