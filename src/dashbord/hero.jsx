'use client'

import React, { useState, useEffect, useRef } from 'react'
import { Heart, Activity, Volume2, AlertTriangle, Mic, MapPin } from 'lucide-react'
import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet'

// Leaflet CSS import (you'll need to add this to your project)
// import 'leaflet/dist/leaflet.css'

export default function Component() {
  const [heartRate, setHeartRate] = useState(70)
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

 // Remove or comment out the useEffect for simulating heart rate and pulse rate changes
  //as we'll now control these directly in the alert logic
  useEffect(() => {
    // Simulate heart rate and pulse rate changes
    const interval = setInterval(() => {
      setHeartRate(prev => Math.floor(Math.random() * (100 - 60 + 1) + 60))
      setPulseRate(prev => Math.floor(Math.random() * (100 - 60 + 1) + 60))
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

    return () => clearInterval(interval)
  }, [])

  const startListening = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      audioContextRef.current = new (window.AudioContext || window.webkitAudioContext)()
      analyserRef.current = audioContextRef.current.createAnalyser()
      microphoneRef.current = audioContextRef.current.createMediaStreamSource(stream)
      microphoneRef.current.connect(analyserRef.current)

      analyserRef.current.fftSize = 256
      const bufferLength = analyserRef.current.frequencyBinCount
      const dataArray = new Uint8Array(bufferLength)

      const updateAudioData = () => {
        if (!isListening) return

        analyserRef.current.getByteFrequencyData(dataArray)
        const average = dataArray.reduce((acc, value) => acc + value, 0) / bufferLength
        const normalizedSoundLevel = Math.min(100, Math.round((average / 128) * 100))
        setSoundLevel(normalizedSoundLevel)

        requestAnimationFrame(updateAudioData)
      }

      updateAudioData()
      setIsListening(true)

      // Set a timeout to trigger the alert after 5 seconds
      const timeout = setTimeout(() => {
        setDetectedKeyword('help')
        setShowAlert(true)
        setHeartRate(Math.floor(Math.random() * (130 - 110 + 1) + 110))
        setPulseRate(Math.floor(Math.random() * (130 - 110 + 1) + 110))
        
        // Set another timeout for the popup
        setTimeout(() => {
          setShowPopup(true)
          // Hide popup after 3 seconds
          setTimeout(() => setShowPopup(false), 3000)
        }, 5000)
      }, 5000)

      setAlertTimeout(timeout)

      // Start speech recognition
      if ('webkitSpeechRecognition' in window || 'SpeechRecognition' in window) {
        const SpeechRecognition = window.webkitSpeechRecognition || window.SpeechRecognition;
        recognitionRef.current = new SpeechRecognition();
        recognitionRef.current.continuous = true;
        recognitionRef.current.interimResults = true;
        recognitionRef.current.lang = 'en-US';

        recognitionRef.current.onstart = () => {
          console.log('Speech recognition started');
          setIsListening(true);
        };

        recognitionRef.current.onresult = (event) => {
          const lastResultIndex = event.results.length - 1;
          const transcript = event.results[lastResultIndex][0].transcript.toLowerCase();

          console.log('Transcript:', transcript);

          // Update detected keyword in real-time
          setDetectedKeyword(transcript);

          keywords.forEach(keyword => {
            if (transcript.includes(keyword.toLowerCase())) {
              console.log('Keyword detected:', keyword);
              setDetectedKeyword(keyword);
              setShowAlert(true);
              setTimeout(() => setShowAlert(false), 5000);
            }
          });
        };

        recognitionRef.current.onerror = (event) => {
          console.error('Speech recognition error:', event.error);
        };

        recognitionRef.current.onend = () => {
          console.log('Speech recognition ended');
          // Restart if still listening
          if (isListening) {
            recognitionRef.current.start();
          }
        };

        recognitionRef.current.start();
      } else {
        console.error('Speech Recognition API not supported in this browser');
        alert('Speech Recognition is not supported in this browser. Please try using Google Chrome.');
      }
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

  return (
    <div className="min-h-screen bg-gradient-to-b from-pink-100 to-purple-200">
      <div className="container mx-auto px-4 py-8">
        <h1 className="text-5xl font-bold text-center mb-2 text-purple-800">Rashmi's Dashboard</h1>
        <h2 className="text-4xl font-bold text-center mb-4 text-purple-800">Sarthi</h2>
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
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <MonitorBox
            title="Heart Rate"
            value={`${heartRate} BPM`}
            icon={<Heart className="w-6 h-6" />}
            color="text-red-500"
            bgColor="bg-red-100"
          />
          <MonitorBox
            title="Pulse Rate"
            value={`${pulseRate} BPM`}
            icon={<Activity className="w-6 h-6" />}
            color="text-blue-500"
            bgColor="bg-blue-100"
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

function MonitorBox({ title, value, icon, color, bgColor }) {
  return (
    <div className={`rounded-lg shadow-md p-6 ${bgColor}`}>
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xl font-semibold">{title}</h2>
        <div className={color}>{icon}</div>
      </div>
      <p className="text-3xl font-bold">{value}</p>
    </div>
  )
}
