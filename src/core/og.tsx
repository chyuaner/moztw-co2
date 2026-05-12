export const OgSensor = ({ id, name, temperature, humidity, co2 }: any) => {
    return (
        <div style={{ 
            display: 'flex', 
            flexDirection: 'column', 
            justifyContent: 'center',
            padding: '80px', 
            backgroundColor: '#f9fafb', 
            width: '1200px', 
            height: '630px',
            fontFamily: 'sans-serif'
        }}>
            <h1 style={{ fontSize: '80px', color: '#111827', marginBottom: '40px' }}>Sensor: {id}</h1>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                <p style={{ fontSize: '50px', color: '#374151', margin: 0 }}>Temp: {temperature} °C</p>
                <p style={{ fontSize: '50px', color: '#374151', margin: 0 }}>Humidity: {humidity} %</p>
                <p style={{ fontSize: '50px', color: '#374151', margin: 0 }}>CO2: {co2} ppm</p>
            </div>
        </div>
    );
}