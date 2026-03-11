import React from 'react';

export default function Home() {
  return (
    <div style={{ 
      display: 'flex', 
      flexDirection: 'column', 
      justifyContent: 'center', 
      alignItems: 'center', 
      minHeight: '100vh', 
      fontFamily: 'sans-serif' 
    }}>
      <h1>Bienvenue sur Twonest!</h1>
      <p>Ton SaaS est maintenant en ligne 🚀</p>
    </div>
  );
}