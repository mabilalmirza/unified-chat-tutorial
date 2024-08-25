import {useEffect} from "react";
import {useNavigate, useParams} from "react-router-dom"

import {VerticalLayout} from "@vaadin/react-components/VerticalLayout";
import {MessageList} from "@vaadin/react-components/MessageList";
import {MessageInput} from "@vaadin/react-components/MessageInput";
import {Notification} from "@vaadin/react-components/Notification";
import {useSignal} from "@vaadin/hilla-react-signals";

import Channel from "Frontend/generated/com/example/application/chat/Channel";
import {ChatService} from "Frontend/generated/endpoints";
import Message from "Frontend/generated/com/example/application/chat/Message";
import {Subscription} from "@vaadin/hilla-frontend";
import {pageTitle} from "Frontend/views/@layout";
import {connectionActive} from "Frontend/util/ConnectionUtil";

const HISTORY_SIZE = 20

export default function ChannelView() {
    const {channelId} = useParams();
    const channel = useSignal<Channel | undefined>(undefined)
    const messages = useSignal<Message[]>([])
    const subscription = useSignal<Subscription<Message[]> | undefined>(undefined)
    const navigate = useNavigate();

    function receiveMessages(incoming: Message[]) {
        const newMessages = [...messages.value, ...incoming]
            .sort((a, b) => a.sequenceNumber - b.sequenceNumber)
            .filter((msg, index, all) => all.findIndex(m => m.messageId === msg.messageId) === index)

        if (newMessages.length > HISTORY_SIZE) {
            newMessages.splice(0, newMessages.length - HISTORY_SIZE)
        }
        messages.value = newMessages
    }

    async function updateChannel() {
        channel.value = channelId ? await ChatService.channel(channelId) : undefined;
        if (!channel.value) {
            navigate("/")
        } else {
            pageTitle.value = channel.value.name
        }
    }

    async function postMessage(message: string) {
        if (!channel.value) {
            throw new Error("No channel to post to")
        }
        try {
            await ChatService.postMessage(channel.value.id, message)
        } catch (e) {
            Notification.show("Failed to send message. Please try again later.", {
                theme: "error",
                position: "bottom-end",
            })
        }
    }

    function unsubscribe() {
        if (subscription.value) {
            console.log("Unsubscribing")
            subscription.value.cancel()
            subscription.value = undefined
        }
    }

    function subscribe() {
        unsubscribe()
        if (channel.value) {
            console.log("Subscribing to ", channel.value.id)
            subscription.value = ChatService.liveMessages(channel.value.id)
                .onNext(receiveMessages)
                .onError(() => console.error("Error in subscription"))
            const lastSeenMessage = messages.value[-1]
            ChatService.messageHistory(channel.value.id, HISTORY_SIZE, lastSeenMessage?.messageId)
                .then(receiveMessages)
                .catch(console.error)
        }
    }

    useEffect(() => {
        if (connectionActive.value) {
            updateChannel().then(subscribe).catch(console.error);
        }
        return unsubscribe
    }, [channelId]);


    return <VerticalLayout theme="padding spacing" className="h-full">
        <MessageList className="h-full w-full border" items={messages.value.map(message => ({
            text: message.message,
            userName: message.author,
            time: message.timestamp,
        }))}/>
        <MessageInput className="w-full" onSubmit={e => postMessage(e.detail.value)}/>
    </VerticalLayout>
}