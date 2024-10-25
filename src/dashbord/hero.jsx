'use client'

import React, { useState, useEffect, useRef } from 'react'

import { Heart, Activity, Volume2, AlertTriangle, Mic, MapPin, Brain } from 'lucide-react'
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet'
import 'leaflet/dist/leaflet.css'
import L from 'leaflet'

// Import Leaflet icon images
import icon from '/map.png';
import iconShadow from 'leaflet/dist/images/marker-shadow.png';

// Set up the default icon for Leaflet
let DefaultIcon = L.icon({
    iconUrl: icon,
    shadowUrl: iconShadow,
    iconSize: [25, 41],
    iconAnchor: [12, 41]
});

L.Marker.prototype.options.icon = DefaultIcon;

function ECGGraph({ color = 'red', rate = 70 }) {
  const svgRef = useRef(null);

  useEffect(() => {
    const svg = svgRef.current;
    let path = '';
    let x = 0;
    const interval = 1200 / rate; // Adjust this value to change the speed of the graph

    function drawLine() {
      const y = 50;
      path += `${x},${y} `;
      x += 1;

      if (x >= 400) {
        x = 0;
        path = '';
      }

      if (x % 40 === 0) {
        // P wave
        path += `${x},${y} ${x+5},${y-10} ${x+10},${y} `;
        // QRS complex
        path += `${x+15},${y} ${x+17},${y+30} ${x+19},${y-30} ${x+21},${y+10} ${x+23},${y} `;
        // T wave
        path += `${x+30},${y} ${x+35},${y+10} ${x+40},${y} `;
        x += 40;
      }

      svg.innerHTML = `<path d="M ${path}" fill="none" stroke="${color}" stroke-width="2" />`;

      requestAnimationFrame(drawLine);
    }

    drawLine();

    return () => cancelAnimationFrame(drawLine);
  }, [color, rate]);

  return (
    <svg ref={svgRef} viewBox="0 0 400 100" className="w-full h-16">
      <path d="" fill="none" stroke={color} strokeWidth="2" />
    </svg>
  );
}

function MonitorBox({ title, value, icon, color, bgColor, showGraph, rate }) {
  return (
    <div className={`rounded-lg shadow-md p-6 ${bgColor}`}>
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xl font-semibold">{title}</h2>
        <div className={color}>{icon}</div>
      </div>
      <p className="text-3xl font-bold mb-2">{value}</p>
      {showGraph && <ECGGraph color={color.replace('text-', '')} rate={rate} />}
    </div>
  )
}

function LocationMarker() {
  const [position, setPosition] = useState(null)
  const map = useMap()

  useEffect(() => {
    map.locate().on("locationfound", function (e) {
      setPosition(e.latlng)
      map.flyTo(e.latlng, 13)
    })
  }, [map])

  return position === null ? null : (
    <Marker position={position}>
      <Popup>You are here</Popup>
    </Marker>
  )
}

export default function Component() {
  const [stressLevel, setStressLevel] = useState(50)
  const [pulseRate, setPulseRate] = useState(75)
  const [soundLevel, setSoundLevel] = useState(0)
  const [detectedKeyword, setDetectedKeyword] = useState('')
  const [showAlert, setShowAlert] = useState(false)
  const [isListening, setIsListening] = useState(false)
  const [location, setLocation] = useState(null)
  const [keywords, setKeywords] = useState(['bachooo', 'help'])
  const recognitionRef = useRef(null)

  const audioContextRef = useRef(null)
  const analyserRef = useRef(null)
  const microphoneRef = useRef(null)

  const [alertTimeout, setAlertTimeout] = useState(null)
  const [showPopup, setShowPopup] = useState(false)

  useEffect(() => {
    // Simulate stress level changes
    const stressInterval = setInterval(() => {
      setStressLevel(prev => Math.max(0, Math.min(100, prev + Math.floor(Math.random() * 21) - 10)))
    }, 3000)

    // Get user's location
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          setLocation({
            lat: position.coords.latitude,
            lng: position.coords.longitude,
          })
        },
        (error) => {
          console.error('Error getting location:', error)
        }
      )
    }

    // Set up interval to send data to backend
    const intervalId = setInterval(sendDataToBackend, 5000);

    // Clean up interval on component unmount
    return () => {
      clearInterval(stressInterval)
      clearInterval(intervalId);
    }
  }, [])

  const sendDataToBackend = async () => {
    const data = {
      stressLevel,
      pulseRate,
      detectedKeyword,
      location: location ? {
        latitude: location.lat,
        longitude: location.lng
      } : null,
      soundLevel,
      timestamp: new Date().toISOString()
    };

    try {
      const response = await fetch('https://sarthibackend.vercel.app/api/monitor', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(data),
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const result = await response.json();
      console.log('Data sent successfully:', result);

      // Check if the backend detected an abnormal condition
      if (result.abnormalConditionDetected) {
        triggerAlert();
      }
    } catch (error) {
      console.error('Error sending data to backend:', error);
    }
  };

  const startListening = async () => {
    try {
      audioContextRef.current = new (window.AudioContext || window.webkitAudioContext)()
      analyserRef.current = audioContextRef.current.createAnalyser()
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      microphoneRef.current = audioContextRef.current.createMediaStreamSource(stream)
      microphoneRef.current.connect(analyserRef.current)

      analyserRef.current.fftSize = 256
      const bufferLength = analyserRef.current.frequencyBinCount
      const dataArray = new Uint8Array(bufferLength)

      const updateSoundLevel = () => {
        analyserRef.current.getByteFrequencyData(dataArray)
        const average = dataArray.reduce((acc, val) => acc + val, 0) / bufferLength
        setSoundLevel(Math.round((average / 255) * 100))
        requestAnimationFrame(updateSoundLevel)
      }

      updateSoundLevel()

      // Speech recognition setup
      if ('webkitSpeechRecognition' in window || 'SpeechRecognition' in window) {
        const SpeechRecognition = window.webkitSpeechRecognition || window.SpeechRecognition
        recognitionRef.current = new SpeechRecognition()
        recognitionRef.current.continuous = true
        recognitionRef.current.interimResults = true
        recognitionRef.current.lang = 'en-US'

        recognitionRef.current.onresult = (event) => {
          const transcript = Array.from(event.results)
            .map(result => result[0].transcript)
            .join('')
          
          console.log('Transcript:', transcript)

          keywords.forEach(keyword => {
            if (transcript.toLowerCase().includes(keyword.toLowerCase())) {
              setDetectedKeyword(keyword)
              triggerAlert()
            }
          })
        }

        recognitionRef.current.start()
      } else {
        console.error('Speech Recognition API not supported in this browser')
      }

      setIsListening(true)
    } catch (error) {
      console.error('Error accessing microphone:', error)
    }
  }

  const stopListening = () => {
    if (microphoneRef.current) {
      microphoneRef.current.disconnect()
    }
    if (audioContextRef.current) {
      audioContextRef.current.close()
    }
    if (recognitionRef.current) {
      recognitionRef.current.stop()
    }
    setIsListening(false)
    setSoundLevel(0)
    setDetectedKeyword('')
    setShowAlert(false)
    setShowPopup(false)
    if (alertTimeout) {
      clearTimeout(alertTimeout)
    }
  }

  const triggerAlert = () => {
    setShowAlert(true)
    const timeout = setTimeout(() => {
      setShowPopup(true)
      setTimeout(() => setShowPopup(false), 3000)
    }, 5000)
    setAlertTimeout(timeout)
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-pink-50 to-purple-200">
      <div className="container mx-auto px-4 py-8">
        <img src="/logo.png" alt="logo" className="w-40 h-40 mx-auto mt-1 " />
        <h2 className="text-3xl font-bold text-center mb-4 text-black-800 font-nunito">SARTHI</h2>
        <p className="text-center text-purple-600 mb-8">
          Real-time monitoring for enhanced safety and peace of mind.
        </p>
        {showAlert && (
          <div className="bg-red-100 border-l-4 border-red-500 text-red-700 p-4 mb-6" role="alert">
            <p className="font-bold">Alert!</p>
            <p>Keyword "{detectedKeyword}" detected. Help is being summoned.</p>
          </div>
        )}
        {showPopup && (
          <div className="fixed inset-0 flex items-center justify-center z-50">
            <div className="bg-white p-6 rounded-lg shadow-xl">
              <h3 className="text-lg font-bold mb-2">Emergency Alert Sent</h3>
              <p>Your location and help request have been sent to nearby volunteers.</p>
            </div>
          </div>
        )}
        <div className="grid grid-cols-1 md:grid-cols-1 lg:grid-cols-4 gap-6 mb-6">
          <MonitorBox
            title="Stress Level"
            value={`${stressLevel}%`}
            icon={<Brain className="w-6 h-6" />}
            color="text-red-500"
            bgColor="bg-red-100"
          />
          <MonitorBox
            title="Pulse Rate"
            value={`${pulseRate} BPM`}
            icon={<Activity className="w-6 h-6" />}
            color="text-blue-500"
            bgColor="bg-blue-100"
            showGraph={true}
            rate={pulseRate}
          />
          <MonitorBox
            title="Sound Level"
            value={`${soundLevel}%`}
            icon={<Volume2 className="w-6 h-6" />}
            color="text-green-500"
            bgColor="bg-green-100"
          />
          <MonitorBox
            title="Keyword Detected"
            value={detectedKeyword || 'None'}
            icon={<AlertTriangle className="w-6 h-6" />}
            color="text-purple-500"
            bgColor="bg-purple-100"
          />
        </div>
        <div className="mb-8">
          <h2 className="text-2xl font-bold mb-4 text-purple-800">Current Location</h2>
          {location ? (
            <div className="h-64 rounded-lg overflow-hidden shadow-md">
              <MapContainer center={[location.lat, location.lng]} zoom={13} style={{ height: '100%', width: '100%' }}>
                <TileLayer
                  url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                  attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                />
                <Marker position={[location.lat, location.lng]}>
                  <Popup>Your current location</Popup>
                </Marker>
              </MapContainer>
            </div>
          ) : (
            <p className="text-center text-gray-600">Loading location...</p>
          )}
        </div>
        <div className="flex justify-center">
          <button
            onClick={isListening ? stopListening : startListening}
            className={`flex items-center px-4 py-2 rounded-full ${
              isListening ? 'bg-red-500 hover:bg-red-600' : 'bg-green-500 hover:bg-green-600'
            } text-white font-semibold transition-colors duration-300`}
          >
            <Mic className="w-5 h-5 mr-2" />
            {isListening ? 'Stop Listening' : 'Start Listening'}
          </button>
        </div>
        <div className="mb-6">
          <label htmlFor="keywords" className="block text-sm font-medium text-gray-700">
            Alert Keywords (comma-separated):
          </label>
          <input
            type="text"
            id="keywords"
            value={keywords.join(', ')}
            onChange={(e) => setKeywords(e.target.value.split(',').map(k => k.trim()))}
            className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-300 focus:ring focus:ring-indigo-200 focus:ring-opacity-50"
          /> 
        </div>
      </div>
    </div>
  )
}
