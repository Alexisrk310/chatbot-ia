'use client';
import { useEffect, useRef, useState } from 'react';
import { MessageSquareText, Loader2, X } from 'lucide-react';

type Message = {
	role: 'user' | 'assistant' | 'system-prompt'; // system-prompt es para la UI, no para la API
	content: string;
};

const STORAGE_KEY = 'chatbot_memory';

// ⚠️ ADVERTENCIA DE SEGURIDAD: Exponer la clave de API directamente en el frontend es INSEGURO.
// Cualquier usuario puede ver y usar esta clave. Se recomienda encarecidamente usar un backend proxy.
const GROQ_API_KEY = import.meta.env.VITE_GROQ_API_KEY;

const MODEL_NAME = 'llama3-8b-8192';
console.log(GROQ_API_KEY);

export default function FloatingChatBot() {
	const [isOpen, setIsOpen] = useState(false);
	const [messages, setMessages] = useState<Message[]>([]);
	const [input, setInput] = useState('');
	const [loading, setLoading] = useState(false);
	const [showInitialOptions, setShowInitialOptions] = useState(false);
	const chatEndRef = useRef<HTMLDivElement | null>(null);

	// Efecto para determinar si se deben mostrar las opciones iniciales al cargar el componente
	useEffect(() => {
		const saved = localStorage.getItem(STORAGE_KEY);
		if (saved) {
			try {
				const parsedMessages: Message[] = JSON.parse(saved);
				if (parsedMessages.length > 0) {
					setShowInitialOptions(true);
				}
			} catch (e) {
				console.error('Error al analizar mensajes de localStorage', e);
				localStorage.removeItem(STORAGE_KEY);
			}
		}
	}, []);

	// Efecto para guardar mensajes en localStorage y hacer scroll
	useEffect(() => {
		// Solo guardar mensajes de 'user' y 'assistant'
		const messagesToSave = messages.filter(
			(msg) => msg.role === 'user' || msg.role === 'assistant'
		);
		localStorage.setItem(STORAGE_KEY, JSON.stringify(messagesToSave));
		chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
	}, [messages]);

	const openChat = () => {
		setIsOpen(true);
		const saved = localStorage.getItem(STORAGE_KEY);
		if (saved) {
			try {
				const parsedMessages: Message[] = JSON.parse(saved);
				if (parsedMessages.length > 0) {
					setShowInitialOptions(true);
					// NO limpiar messages aquí. Se mostrarán las opciones y luego se cargarán al hacer click en "Continuar".
				} else {
					setShowInitialOptions(false);
					setMessages([]); // Asegurar que el chat esté vacío si no hay historial
				}
			} catch (e) {
				console.error('Error al analizar mensajes de localStorage', e);
				localStorage.removeItem(STORAGE_KEY);
				setShowInitialOptions(false);
				setMessages([]);
			}
		} else {
			setShowInitialOptions(false);
			setMessages([]); // Asegurar que el chat esté vacío si no hay historial
		}
	};

	const closeChat = () => {
		setIsOpen(false);
		setShowInitialOptions(false); // Ocultar opciones al cerrar
		// NO limpiar mensajes aquí, se mantienen en localStorage para la próxima apertura
	};

	const handleContinueChat = () => {
		const saved = localStorage.getItem(STORAGE_KEY);
		if (saved) {
			try {
				const parsedMessages: Message[] = JSON.parse(saved);
				setMessages(parsedMessages); // Cargar todos los mensajes guardados
			} catch (e) {
				console.error('Error al analizar mensajes de localStorage', e);
				localStorage.removeItem(STORAGE_KEY);
				setMessages([]);
			}
		}
		setShowInitialOptions(false); // Ocultar las opciones después de seleccionar
	};

	const handleStartNewChat = () => {
		localStorage.removeItem(STORAGE_KEY); // Borrar historial
		setMessages([]); // Limpiar mensajes
		setShowInitialOptions(false); // Ocultar las opciones después de seleccionar
	};

	const sendMessage = async () => {
		if (!input.trim()) return;

		// Filtrar mensajes de system-prompt antes de enviar a la API
		const messagesForAPI = messages.filter(
			(msg) => msg.role !== 'system-prompt'
		);
		const newMessages: Message[] = [
			...messagesForAPI,
			{ role: 'user', content: input.trim() },
		];
		setMessages(newMessages); // Actualizar el estado con el nuevo mensaje del usuario
		setInput('');
		setLoading(true);

		try {
			const res = await fetch(
				'https://api.groq.com/openai/v1/chat/completions',
				{
					method: 'POST',
					headers: {
						Authorization: `Bearer ${GROQ_API_KEY}`,
						'Content-Type': 'application/json',
					},
					body: JSON.stringify({
						model: MODEL_NAME,
						messages: [
							{
								role: 'system',
								content:
									'Eres un asistente de soporte para una tienda de tecnología en Colombia. Tu objetivo es ayudar a los clientes con sus preguntas sobre productos, servicios, y cualquier otra consulta relacionada con la tienda. Sé amable y profesional.',
							},
							...newMessages, // Enviar los mensajes actualizados incluyendo el del usuario
						],
						temperature: 0.7,
					}),
				}
			);

			const data = await res.json();
			if (!res.ok)
				throw new Error(data?.error?.message || 'Error al consultar IA');

			const reply = data?.choices?.[0]?.message?.content ?? 'Respuesta vacía';
			setMessages([...newMessages, { role: 'assistant', content: reply }]); // Añadir la respuesta de la IA
		} catch (error) {
			console.error(error);
			setMessages((prev) => [
				...prev,
				{
					role: 'assistant',
					content: '⚠️ Error al contactar con el servidor.',
				},
			]);
		} finally {
			setLoading(false);
		}
	};

	return (
		<div className="fixed bottom-6 right-6 z-50">
			{/* Botón flotante (solo visible cuando el chat está cerrado) */}
			{!isOpen && (
				<button
					onClick={openChat}
					className="bg-green-500 hover:bg-green-600 text-white w-14 h-14 rounded-full shadow-lg flex items-center justify-center text-2xl transition-transform duration-300 transform hover:scale-110"
					aria-label="Abrir chat">
					<MessageSquareText className="w-7 h-7" />
				</button>
			)}

			{/* Chatbox (visible cuando el chat está abierto) */}
			{isOpen && (
				<div className="w-80 sm:w-96 max-h-[600px] bg-white rounded-xl shadow-2xl flex flex-col border border-gray-200">
					{/* Header */}
					<div className="bg-green-600 text-white p-4 rounded-t-xl flex items-center justify-between shadow-md">
						<h2 className="text-lg font-semibold flex items-center gap-2">
							<MessageSquareText className="w-5 h-5" />
							{'Asistente Virtual'}
						</h2>
						<button
							onClick={closeChat}
							className="text-white hover:bg-green-700 p-1 rounded-md transition-colors"
							aria-label="Cerrar chat">
							<X className="w-5 h-5" />
						</button>
					</div>

					{/* Mensajes */}
					<div className="flex-1 overflow-y-auto p-4 space-y-4 bg-gray-50">
						{showInitialOptions ? (
							<div className="text-center py-6 px-4 space-y-4 bg-blue-50 rounded-lg border border-blue-200 text-blue-800 shadow-sm">
								<p className="font-bold text-lg">{'¡Bienvenido de nuevo!'}</p>
								<p className="text-sm">
									{
										'¿Quieres continuar con tu chat anterior o empezar uno nuevo?'
									}
								</p>
								<div className="flex flex-col gap-3 px-2 mt-4">
									<button
										onClick={handleContinueChat}
										className="bg-green-500 hover:bg-green-600 text-white py-2.5 px-4 rounded-lg font-medium transition-colors shadow-md">
										{'Continuar chat anterior'}
									</button>
									<button
										onClick={handleStartNewChat}
										className="border border-gray-300 text-gray-700 hover:bg-gray-100 py-2.5 px-4 rounded-lg font-medium transition-colors shadow-sm">
										{'Iniciar nuevo chat'}
									</button>
								</div>
							</div>
						) : (
							<>
								{messages.length === 0 && !loading && (
									<div className="text-center py-4 px-2 space-y-2 text-gray-600">
										<p className="font-medium text-base">
											{'¡Hola! ¿En qué puedo ayudarte hoy?'}
										</p>
										<p className="text-sm">
											{'Soy tu asistente virtual para la tienda de tecnología.'}
										</p>
									</div>
								)}
								{messages.map((msg, i) => (
									<div key={i}>
										{/* Solo renderizar mensajes de usuario y asistente */}
										{msg.role !== 'system-prompt' && (
											<div
												className={`flex items-start gap-3 ${
													msg.role === 'user' ? 'justify-end' : 'justify-start'
												}`}>
												{msg.role === 'assistant' && (
													<div className="w-8 h-8 rounded-full bg-gray-300 text-gray-800 flex items-center justify-center text-xs font-semibold flex-shrink-0">
														{'AI'}
													</div>
												)}
												<div
													className={`px-4 py-2 rounded-xl max-w-[80%] text-sm whitespace-pre-wrap shadow-sm ${
														msg.role === 'user'
															? 'bg-green-100 text-green-800 rounded-br-none'
															: 'bg-gray-200 text-gray-800 rounded-bl-none'
													}`}>
													{msg.content}
												</div>
												{msg.role === 'user' && (
													<div className="w-8 h-8 rounded-full bg-green-500 text-white flex items-center justify-center text-xs font-semibold flex-shrink-0">
														{'Tú'}
													</div>
												)}
											</div>
										)}
									</div>
								))}
								{loading && (
									<div className="flex items-center gap-2 text-gray-500 italic mt-2">
										<Loader2 className="w-4 h-4 animate-spin" />
										{'Escribiendo...'}
									</div>
								)}
							</>
						)}
						<div ref={chatEndRef} />
					</div>

					{/* Input */}
					{!showInitialOptions && ( // Ocultar input cuando se muestran las opciones iniciales
						<div className="flex border-t border-gray-200 p-4 bg-white">
							<input
								type="text"
								placeholder="Escribe tu mensaje..."
								value={input}
								onChange={(e) => setInput(e.target.value)}
								onKeyDown={(e) => {
									if (e.key === 'Enter' && !e.shiftKey) {
										e.preventDefault();
										sendMessage();
									}
								}}
								className="flex-1 mr-2 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500 transition-all"
								aria-label="Mensaje de chat"
							/>
							<button
								onClick={sendMessage}
								disabled={loading || !input.trim()}
								className="bg-green-500 hover:bg-green-600 text-white py-2 px-4 rounded-md disabled:opacity-50 transition-colors">
								{'Enviar'}
							</button>
						</div>
					)}
				</div>
			)}
		</div>
	);
}
