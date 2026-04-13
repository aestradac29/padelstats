
import * as XLSX from 'xlsx';

export const downloadExcelTemplate = () => {
    const headers = [
        'Fecha', 
        'Hora', 
        'Local/Visitante', 
        'Rival', 
        'Sede/Notas', 
        'Modo Historico (Si/No)', 
        'Jornada de descanso (Si/No)', 
        'Tandas (Ej. 2-2-1)'
    ];
    
    const exampleData = [
        {
            'Fecha': '2024-05-20',
            'Hora': '10:00',
            'Local/Visitante': 'Local',
            'Rival': 'Padel Club A',
            'Sede/Notas': 'Pista 1',
            'Modo Historico (Si/No)': 'No',
            'Jornada de descanso (Si/No)': 'No',
            'Tandas': '5'
        },
        {
            'Fecha': '2024-05-27',
            'Hora': '18:30',
            'Local/Visitante': 'Visitante',
            'Rival': 'Los Amigos',
            'Sede/Notas': 'Club Deportivo',
            'Modo Historico (Si/No)': 'No',
            'Jornada de descanso (Si/No)': 'No',
            'Tandas': '5'
        }
    ];

    const worksheet = XLSX.utils.json_to_sheet(exampleData, { header: headers });
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Plantilla Calendario');

    // Generate buffer
    const excelBuffer = XLSX.write(workbook, { bookType: 'xlsx', type: 'array' });
    const data = new Blob([excelBuffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    
    // Download
    const url = window.URL.createObjectURL(data);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', 'Plantilla_Calendario_PadelStats.xlsx');
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
};
