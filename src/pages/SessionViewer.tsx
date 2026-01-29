import { useEffect, useState } from "react"
import { useParams } from "react-router-dom"
import { api } from "../services/api"

interface Segment {
    speaker?: string
    text: string
    block_id?: number
}

interface SessionData {
    id?: string
    _id?: string
    transcription?: {
        segments?: Segment[]
        notes?: string
    }
}

interface Block {
    block_id: number
    speeches: Record<string, string[]>
}

export default function SessionViewer() {
    const { id } = useParams()
    const [session, setSession] = useState<SessionData | null>(null)
    const [blocks, setBlocks] = useState<Block[]>([])

    useEffect(() => {
        async function load() {
            const { data } = await api.get(`/sessions/${id}`)
            setSession(data)

            const segments = Array.isArray(data?.transcription?.segments)
                ? data.transcription.segments
                : []

            buildBlocks(segments)
        }

        load()
    }, [id])

    function buildBlocks(segments: Segment[]) {
        const result: Block[] = []

        let currentBlock: Block | null = null
        let lastSpeaker: string | null = null

        segments.forEach((seg, index) => {
            const speaker = seg.speaker || "Desconhecido"

            // mesmo falante → acumula
            if (currentBlock && speaker === lastSpeaker) {
                currentBlock.speeches[speaker].push(seg.text)
                return
            }

            // novo falante → novo bloco
            currentBlock = {
                block_id: index,
                speeches: {
                    [speaker]: [seg.text]
                }
            }

            result.push(currentBlock)
            lastSpeaker = speaker
        })

        setBlocks(result)
    }

    console.log(session)


    if (!session) return <p>Carregando sessão...</p>

    return (
        <div style={{ padding: 24 }}>
            <h2>Sessão</h2>

            {blocks.length === 0 && (
                <p style={{ opacity: 0.6 }}>Esta sessão ainda não possui transcrição.</p>
            )}

            {blocks.map(block => (
                <div
                    key={block.block_id}
                    style={{
                        border: "1px solid #333",
                        borderRadius: 8,
                        padding: 16,
                        marginBottom: 24
                    }}
                >
                    {Object.entries(block.speeches).map(([speaker, texts]) => (
                        <div key={speaker} style={{ marginBottom: 12 }}>
                            <strong>{speaker}</strong>
                            <p style={{ whiteSpace: "pre-line", marginTop: 4 }}>
                                {texts.join(" ")}
                            </p>
                        </div>
                    ))}

                    {session.transcription?.notes && (
                        <>
                            <hr />
                            <strong>Nota da Transcrição</strong>
                            <p>{session.transcription.notes}</p>
                        </>
                    )}
                </div>
            ))}
        </div>
    )
}
