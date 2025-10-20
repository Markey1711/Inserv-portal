import React, { useState } from 'react';

export default function ImportTmc() {
  const [file, setFile] = useState(null);
  const [log, setLog] = useState(null);
  const [loading, setLoading] = useState(false);

  function handleFileChange(e) {
    setFile(e.target.files[0]);
  }

  function handleUpload() {
    if (!file) return;
    setLoading(true);
    setLog(null);
    const formData = new FormData();
    formData.append('file', file);
    fetch('http://localhost:3001/api/tmc/import', {
      method: 'POST',
      body: formData
    })
      .then(r => r.json())
      .then(data => {
        setLog(data);
      })
      .catch(err => setLog({ error: err.message }))
      .finally(() => setLoading(false));
  }

  return (
    <div style={{border:'1px solid #ccc', padding:16, borderRadius:8, marginBottom:24}}>
      <h3>Импорт справочника ТМЦ (Excel/CSV)</h3>
      <input type="file" accept=".xlsx,.xls,.csv" onChange={handleFileChange} />
      <button disabled={!file || loading} onClick={handleUpload} style={{marginLeft:8}}>
        {loading ? 'Импорт...' : 'Загрузить'}
      </button>
      {log && (
        <pre style={{
          background:'#f7f7f7', padding:8, marginTop:12, maxHeight:200, overflow:'auto',
          fontSize:13
        }}>{JSON.stringify(log, null, 2)}</pre>
      )}
      <p style={{fontSize:12, color:'#555'}}>
        Первая строка файла должна содержать заголовки: Код, Наименование, Группа, Категория, Ед. изм., Цена, Поставщик, Комментарий, Фото, Амортизация (мес.).  
        Допустимы вариации (регистр, пробелы, "ед изм", "стоимость", "амортизация" и т.п.).
      </p>
    </div>
  );
}