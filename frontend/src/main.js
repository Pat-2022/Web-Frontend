import { BACKEND_PORT } from './config.js';
// A helper you may want to use when uploading new images to the server.
import { fileToDataUrl } from './helpers.js';

let token = null;
let userId = null;
let channelIdCurrent = null;
let msgs_flags = {};
let msgs_len = null;
let startindex = 0;
let msgs_pin_flags = {};
let users_dict = {};


//Trigger an error popup
const errorPopup = (message) => {
    document.getElementById("ptag").innerText = message;
    jQuery('#ErrorModal').modal('show');

}

//a function that checks whether an object has a certain key
const isKeyInObject = (object, key) => {
    return Object.keys(object).some(v => v == key);
}

//use user-id to get the user-name
const getUserName = (userId) => {
    return new Promise((resolve, reject) => {
        makeRequest(`/user/${userId}`, 'GET')
            .then(data => {
                resolve(data.name);
            }).catch(error => {
                reject(error);
            });
    });
}

//make request to the server
const makeRequest = (route, method, body) => {
    const options = {
        method: method,
        headers: {
            'Content-Type': 'application/json',
            'Authorization': 'Bearer ' + token
        }
    };

    if (body !== undefined) {
        options.body = JSON.stringify(body);
    }
    
    return new Promise((resolve, reject) => {
        fetch(`http://localhost:${BACKEND_PORT}`+ route, options)
            .then(rawresponse => {
                return rawresponse.json();
            }).then(data => {
                if (data.error) {
                    reject(data.error);
                } else {
                    resolve(data);
                }
            });
    });
};

//Upon clicking the register button, make a request to the server to register the user
document.getElementById('register-action').addEventListener('click', () => {
    const email = document.getElementById('register-email-input').value;
    const password = document.getElementById('register-password-input').value;
    const confirmPassword = document.getElementById('confirm-password-input').value;
    
    //check if the password and confirm password are the same
    if (password !== confirmPassword) {
        errorPopup('Passwords do not match');
        return;
    };

    const name = document.getElementById('register-name-input').value;
    const body = { 
        "email": email,
        "password": password,
        "name": name};

    makeRequest('/auth/register', 'POST', body)
    .then(data => {
        token = data.token;
        userId = data.userId;
        login();
    })
    .catch(error => {
        errorPopup(error);
    });
});


//Upon clicking the login button, make a request to the server to login the user
document.getElementById('login-action').addEventListener('click', () => {
    const email = document.getElementById('login-email').value;
    const password = document.getElementById('login-password').value;
    const body = { 
        "email": email,
        "password": password};

    makeRequest('/auth/login', 'POST', body)
    .then(data => {
        token = data.token;
        userId = data.userId;
        login();
    })
    .catch(error => {
        errorPopup(error);
    });

});

//a function that determines whether the message is a white space
const onlySpaces= (str) => {
    return /^\s*$/.test(str);
}

//Upon clicking the msgsend button, make a request to the server to send the message
document.getElementById('msgsend-action').addEventListener('click', () => {
    const message = document.getElementById('msgsend-text').value;

    if ( onlySpaces(message) ) {
        errorPopup('Message cannot be empty');
        return;
    }

    const body = { 
        "message": message
    };

    makeRequest('/message/'+channelIdCurrent, 'POST', body)
    .then(data => {
        displayChannel(channelIdCurrent);
    })
    .catch(error => {
        errorPopup(error);
    });
    document.getElementById('msgsend-text').value='';
});


//Upon clicking the create-form button, make a request to the server to create a new channel
document.getElementById('create-form').addEventListener('click', () => {
    const channel_name = form["channel_name"].value;
    const channel_description = form["channel_description"].value;
    const channel_type = form["channel_type"].value;

    //make sure the channel has a name
    if (channel_name === "") {
        errorPopup("Channel name cannot be empty");
        return;
    }

    let private_bool = false;
    if (channel_type === 'Public') {
        private_bool = false;
    } else {
        private_bool = true;
    }

    const body = { 
        "name": channel_name,
        "private": private_bool,
        "description": channel_description,
    };

    makeRequest('/channel', 'POST', body)
    .then(data => {
       displayChannels();
    })
    .catch(error => {
        errorPopup(error);
    });
});


//Upon clicking the logout button, make a request to the server to logout the user
document.getElementById('logout-action').addEventListener('click', () => {
    makeRequest('/auth/logout', 'POST', {})
    .then(data => {
        logout();
    })
    .catch(error => {
        errorPopup(error);
    });
});

//a function that gets the info section of a channel
const displayChannel_get_info = (channelId) => {
    makeRequest('/channel/'+channelId, 'GET', undefined)
    .then(data => {
        const members = data.members;
        const channel_name = data.name;
        const channel_description = data.description;
        //initiate the state
        document.getElementById("change-channel-info-action").disabled = false;
        document.getElementById('channel-messages').classList.remove('hide');
        document.getElementById('join-channel-action').classList.add('hide');
        document.getElementById('leave-channel-action').classList.remove('hide');
        //get the channel type
        let channel_type = "Public";
        if (data.private) {
            channel_type = "Private";
        }
        //get the channel created time
        const t = new Date(data.createdAt);
        const dateStr = t.toISOString().split('T')[0];
        const timeStr = t.toTimeString().split(' ')[0];
        const channel_timestamp = dateStr + ' ' + timeStr;

        //get the channel creator
        const channel_creator = getUserName(data.creator);
        channel_creator.then((data) => {
            document.getElementById('channel-creator').innerText = data;
        })
        .catch(error => {
            errorPopup(error);
        });

        //display the channel info
        document.getElementById('channel-name').value=channel_name;
        document.getElementById('channel-description').value=channel_description;
        document.getElementById('channel-type').innerText = channel_type;
        document.getElementById('channel-timestamp').innerText = channel_timestamp;
    })
    //if the user is not a member of the channel
    .catch(() =>{
        document.getElementById("change-channel-info-action").disabled = true;
        document.getElementById('channel-messages').classList.add('hide');
        document.getElementById('join-channel-action').classList.remove('hide');
        document.getElementById('leave-channel-action').classList.add('hide');
    });
};

//a function that gets all the pinned messages of this channel
const displayChannel_get_pinned_promise = (channelId,start) => {
    const get_msg_promise = makeRequest('/message/' + channelId + `?start=${start}`, 'GET', undefined)
    .then(data => {
        for (const messageObj of data.messages) {
            msgs_pin_flags[messageObj.id] = messageObj.pinned;
            if (msgs_pin_flags[messageObj.id]){
                const messageDiv = document.createElement('div');
                messageDiv.id='pinned-message-div'+messageObj.id;;

                const senderMessageDiv = document.createElement('div');
                senderMessageDiv.id = 'pinned-sender-message'+messageObj.id;

                const senderInfoDiv = document.createElement('div');
                senderInfoDiv.id='pinned-sender-info'+messageObj.id;

                const senderNameSpan = document.createElement('span');
                senderNameSpan.id='pinned-sender-name'+messageObj.id;

                const senderPhotoImg = document.createElement('img');
                senderPhotoImg.id='pinned-sender-photo'+messageObj.id;

                const senderTimestampSpan = document.createElement('span');
                senderTimestampSpan.id='pinned-sender-timestamp'+messageObj.id;

                senderMessageDiv.innerText = messageObj.message;

                //get the message sender name
                const message_sender = getUserName(messageObj.sender);
                message_sender.then((data) => {
                    senderNameSpan.innerText = data;
                    senderPhotoImg.alt=`user ${data}'s photo`;
                })
                .catch(error => {
                    senderPhotoImg.alt="user's photo";
                    errorPopup(error);
                });

                //get date and time
                let t = '';
                if (messageObj.editedAt) {
                    t = new Date(messageObj.editedAt);
                } else {
                    t = new Date(messageObj.sentAt);
                }

                const dateStr = t.toISOString().split('T')[0];
                const timeStr = t.toTimeString().split(' ')[0];
                senderTimestampSpan.innerText = dateStr + ' ' + timeStr;
                if (messageObj.editedAt) {
                    senderTimestampSpan.innerText = dateStr + ' ' + timeStr+('(edited)');
                }

                if (isKeyInObject(messageObj, 'image')) {
                    senderPhotoImg.src = messageObj.image;
                } else {
                    senderPhotoImg.src = 'https://www.w3schools.com/howto/img_avatar.png';
                }

                document.getElementById('pinned-messages').appendChild(messageDiv);
                document.getElementById('pinned-message-div'+messageObj.id).appendChild(senderMessageDiv);


                const messageEmojiDiv = document.createElement('div');
                messageEmojiDiv.id = 'pinned-message-emoji-div'+messageObj.id;
                const messageEmojiLike = document.createElement('button');
                messageEmojiLike.id = 'pinned-message-emoji-like'+messageObj.id;
                messageEmojiLike.className = 'emoji-button';
                messageEmojiLike.innerText = '👍';
                const messageEmojiSmile = document.createElement('button');
                messageEmojiSmile.id = 'pinned-message-emoji-smile'+messageObj.id;
                messageEmojiSmile.className = 'emoji-button';
                messageEmojiSmile.innerText = '😄';
                const messageEmojiAngry = document.createElement('button');
                messageEmojiAngry.id = 'pinned-message-emoji-angry'+messageObj.id;
                messageEmojiAngry.className = 'emoji-button';
                messageEmojiAngry.innerText = '😡';
                document.getElementById('pinned-message-div'+messageObj.id).appendChild(messageEmojiDiv);
                document.getElementById('pinned-message-emoji-div'+messageObj.id).appendChild(messageEmojiLike);
                document.getElementById('pinned-message-emoji-div'+messageObj.id).appendChild(messageEmojiSmile);
                document.getElementById('pinned-message-emoji-div'+messageObj.id).appendChild(messageEmojiAngry);


                //an object(dictionary) that stores the flags of the emojis for each message
                msgs_flags[messageObj.id] = {'smile':false,
                                            'like':false,
                                            'angry':false
                                            };
                
                //display the emojis for each message                            
                for (const reactObj of messageObj.reacts) {
                    if (reactObj.react === 'like') {
                        document.getElementById('pinned-message-emoji-like'+messageObj.id).classList.add('emoji_check');
                        msgs_flags[messageObj.id]['like'] = true;
                    } else if (reactObj.react === 'smile') {
                        document.getElementById('pinned-message-emoji-smile'+messageObj.id).classList.add('emoji_check');
                        msgs_flags[messageObj.id]['smile'] = true;
                    } else if (reactObj.react === 'angry') {
                        document.getElementById('pinned-message-emoji-angry'+messageObj.id).classList.add('emoji_check');
                        msgs_flags[messageObj.id]['angry'] = true;
                    } 
                }

                //add click listeners to the emoji
                const emoji_EventListener = (emoji) => {
                    const emoji_id = `pinned-message-emoji-${emoji}`+messageObj.id;
                    const another_emoji_id = `message-emoji-${emoji}`+messageObj.id;
                    const body={
                        "react": emoji
                    }
                    document.querySelector(`#${emoji_id}`).addEventListener('click', () => {
                        if(msgs_flags[messageObj.id][emoji]){
                            makeRequest('/message/unreact/'+`${channelIdCurrent}/${messageObj.id}`, 'POST', body)
                            .then(data => {
                                document.querySelector(`#${emoji_id}`).classList.remove('emoji_check');
                                document.querySelector(`#${another_emoji_id}`).classList.remove('emoji_check');
                                msgs_flags[messageObj.id][emoji] =false;
                            })
                            .catch(err => {
                                errorPopup(err);
                            })
                        }else{
                            makeRequest('/message/react/'+`${channelIdCurrent}/${messageObj.id}`, 'POST', body)
                            .then(data => {
                                document.querySelector(`#${emoji_id}`).classList.add('emoji_check');
                                document.querySelector(`#${another_emoji_id}`).classList.add('emoji_check');
                                msgs_flags[messageObj.id][emoji] =true;
                            })
                            .catch(err => {
                                errorPopup(err);
                            })
                        }
                    });
                }

                emoji_EventListener('like');
                emoji_EventListener('smile');
                emoji_EventListener('angry');
                

                document.getElementById('pinned-message-div'+messageObj.id).appendChild(senderInfoDiv);
                document.getElementById('pinned-sender-info'+messageObj.id).appendChild(senderNameSpan);
                document.getElementById('pinned-sender-info'+messageObj.id).appendChild(senderPhotoImg);
                document.getElementById('pinned-sender-info'+messageObj.id).appendChild(senderTimestampSpan);

                if (messageObj.sender === userId) {
                    const deleteMessageButton = document.createElement('button');
                    deleteMessageButton.classList.add('delete-message-button');
                    deleteMessageButton.innerText = 'Delete';
                    document.getElementById('pinned-sender-info'+messageObj.id).appendChild(deleteMessageButton);

                    //delete message
                    deleteMessageButton.onclick = () => {
                        makeRequest('/message/'+channelId+'/'+ messageObj.id, 'DELETE', undefined)
                        .then(() => {
                            displayChannel(channelId);
                            // displayChannel_get_msgs(channelId,startindex);
                            // displayChannel_get_pinned(channelId);
                        })
                        .catch((error) => {
                            errorPopup(error);
                        });
                    };

                    const editMessageButton = document.createElement('button');
                    editMessageButton.id='pinned-edit-message-button'+messageObj.id;
                    editMessageButton.innerText = 'Edit';
                    document.getElementById('pinned-sender-info'+messageObj.id).appendChild(editMessageButton);
                    
                    const editMessageConfirmButton = document.createElement('button');
                    editMessageConfirmButton.id='pinned-edit-message-confirm-button'+messageObj.id;
                    editMessageConfirmButton.innerText = 'Confirm editing';
                    editMessageConfirmButton.classList.add('hide');
                    document.getElementById('pinned-sender-info'+messageObj.id).appendChild(editMessageConfirmButton);

                    //Upon clicking the edit message button, show the edit message state
                    document.getElementById('pinned-edit-message-button'+messageObj.id).onclick = () => {
                        document.getElementById('pinned-sender-message'+messageObj.id).style.backgroundColor = "white";
                        document.getElementById('pinned-sender-message'+messageObj.id).contentEditable = true;
                        document.getElementById('pinned-edit-message-confirm-button'+messageObj.id).classList.remove('hide');
                        document.getElementById('pinned-sender-message'+messageObj.id).focus();
                    }

                    //Upon clicking the confirm editing button, send the edited message to the server
                    document.getElementById('pinned-edit-message-confirm-button'+messageObj.id).addEventListener('mousedown', () => {
                        const message =document.getElementById('pinned-sender-message'+messageObj.id).innerText;
                        if (message===messageObj.message){
                            errorPopup('Cannot edit a message to the same existing message');
                            return;
                        } 

                        const image = document.getElementById('pinned-sender-photo'+messageObj.id).src;
                        const body = { 
                            "message": message,
                            "image": image
                        };
                        makeRequest('/message/'+channelId+'/'+ messageObj.id, 'PUT', body)
                        .then(() => {
                            document.getElementById('pinned-sender-message'+messageObj.id).style.backgroundColor = null;
                            document.getElementById('pinned-sender-message'+messageObj.id).contentEditable = false;
                            document.getElementById('pinned-edit-message-confirm-button'+messageObj.id).classList.add('hide');
                            displayChannel(channelId);
                            // displayChannel_get_msgs(channelId,startindex);
                            // displayChannel_get_pinned(channelId);

                        })
                        .catch((error) => {
                            errorPopup(error);
                        });
                    });

                    document.getElementById('pinned-sender-message'+messageObj.id).addEventListener('focusout', () => {
                        document.getElementById('pinned-sender-message'+messageObj.id).contentEditable = false;
                        document.getElementById('pinned-sender-message'+messageObj.id).style.backgroundColor = "transparent";
                        document.getElementById('pinned-edit-message-confirm-button'+messageObj.id).classList.add('hide');
                    });
                    
                }

                //create a pin/unpin message button
                const msgPin_UnpinButton = document.createElement('button');
                msgPin_UnpinButton.id='pinned-message-PinUnpin-button'+messageObj.id;
                msgPin_UnpinButton.innerText = 'Pin/Unpin';
                document.getElementById('pinned-sender-info'+messageObj.id).appendChild(msgPin_UnpinButton);

                //Unon clicking the pin/unpin button, pin/unpin the message to the server
                msgPin_UnpinButton.onclick = () => {
                    if (msgs_pin_flags[messageObj.id]){
                        makeRequest('/message/unpin/'+channelId+'/'+ messageObj.id, 'POST', undefined)
                        .then(() => {
                            // displayChannel(channelId);
                            displayChannel_get_pinned(channelId);
                            msgs_pin_flags[messageObj.id] = false;
                        })
                    } else {
                        makeRequest('/message/pin/'+channelId+'/'+ messageObj.id, 'POST', undefined)
                        .then(() => {
                            // displayChannel(channelId);
                            displayChannel_get_pinned(channelId);
                            msgs_pin_flags[messageObj.id] = true;
                        })
                    }
                };

                document.getElementById('pinned-messages').appendChild(document.createElement('hr'));
            }
        }
        return data.messages.length;
    })
    .catch(error => {
        // console.error(error);
    });
    const await_get_msgs = async() => {
        const a = await get_msg_promise;
        return a;
    };
    const amsg=await_get_msgs();
    return amsg;
}

//a function that displays pinned messages of a channel
const displayChannel_get_pinned = (channelId) => {
    document.getElementById('pinned-messages').remove();
    const newpinned_messages = document.createElement('div');
    newpinned_messages.id = 'pinned-messages';
    document.getElementById('pinned-messages-container').appendChild(newpinned_messages);

    let start=0;
    let msg_gone_through = null;
    const afunction = async() => {
        while (msg_gone_through !== 0) {
            const y =  await displayChannel_get_pinned_promise(channelId,start)
            .then((data) => {
                msg_gone_through=data;
                start += 25;
                if (msg_gone_through === undefined){
                    msg_gone_through = 0;
                }
            })
            .catch((error) => {
                console.error(error);
            });
        }
    }
    afunction();
};


//a function that gets the messages in the channel
const displayChannel_get_msgs = (channelId,startindex) => {
    document.getElementById('invite-button').disabled = false;
    const get_msg_promise = makeRequest('/message/' + channelId + `?start=${startindex}`, 'GET', undefined)
        .then(data => {
            for (const messageObj of data.messages) {
                msgs_pin_flags[messageObj.id] = messageObj.pinned;

                const messageDiv = document.createElement('div');
                messageDiv.id='message-div'+messageObj.id;

                const senderMessageDiv = document.createElement('div');
                senderMessageDiv.id = 'sender-message'+messageObj.id;

                const senderInfoDiv = document.createElement('div');
                senderInfoDiv.id='sender-info'+messageObj.id;

                const senderNameSpan = document.createElement('span');
                senderNameSpan.id='sender-name'+messageObj.id;

                const senderPhotoImg = document.createElement('img');
                senderPhotoImg.id='sender-photo'+messageObj.id;

                const senderTimestampSpan = document.createElement('span');
                senderTimestampSpan.id='sender-timestamp'+messageObj.id;

                senderMessageDiv.innerText = messageObj.message;

                //get the message sender name
                const message_sender = getUserName(messageObj.sender);
                message_sender.then((data) => {
                    senderNameSpan.innerText = data;
                    senderPhotoImg.alt=`user ${data}'s photo`;
                })
                .catch(error => {
                    senderPhotoImg.alt="user's photo";
                    errorPopup(error);
                });

                //get date and time
                let t = '';
                if (messageObj.editedAt) {
                    t = new Date(messageObj.editedAt);
                } else {
                    t = new Date(messageObj.sentAt);
                }

                const dateStr = t.toISOString().split('T')[0];
                const timeStr = t.toTimeString().split(' ')[0];
                senderTimestampSpan.innerText = dateStr + ' ' + timeStr;
                if (messageObj.editedAt) {
                    senderTimestampSpan.innerText = dateStr + ' ' + timeStr+('(edited)');
                }

                if (isKeyInObject(messageObj, 'image')) {
                    senderPhotoImg.src = messageObj.image;
                } else {
                    senderPhotoImg.src = 'https://www.w3schools.com/howto/img_avatar.png';
                }

                document.getElementById('channel-messages-body').appendChild(messageDiv);
                document.getElementById('message-div'+messageObj.id).appendChild(senderMessageDiv);


                const messageEmojiDiv = document.createElement('div');
                messageEmojiDiv.id = 'message-emoji-div'+messageObj.id;
                const messageEmojiLike = document.createElement('button');
                messageEmojiLike.id = 'message-emoji-like'+messageObj.id;
                messageEmojiLike.className = 'emoji-button';
                messageEmojiLike.innerText = '👍';
                const messageEmojiSmile = document.createElement('button');
                messageEmojiSmile.id = 'message-emoji-smile'+messageObj.id;
                messageEmojiSmile.className = 'emoji-button';
                messageEmojiSmile.innerText = '😄';
                const messageEmojiAngry = document.createElement('button');
                messageEmojiAngry.id = 'message-emoji-angry'+messageObj.id;
                messageEmojiAngry.className = 'emoji-button';
                messageEmojiAngry.innerText = '😡';
                document.getElementById('message-div'+messageObj.id).appendChild(messageEmojiDiv);
                document.getElementById('message-emoji-div'+messageObj.id).appendChild(messageEmojiLike);
                document.getElementById('message-emoji-div'+messageObj.id).appendChild(messageEmojiSmile);
                document.getElementById('message-emoji-div'+messageObj.id).appendChild(messageEmojiAngry);


                //an object(dictionary) that stores the flags of the emojis for each message
                msgs_flags[messageObj.id] = {'smile':false,
                                            'like':false,
                                            'angry':false
                                            };
                
                //display the emojis for each message                            
                for (const reactObj of messageObj.reacts) {
                    if (reactObj.react === 'like') {
                        document.getElementById('message-emoji-like'+messageObj.id).classList.add('emoji_check');
                        msgs_flags[messageObj.id]['like'] = true;
                    } else if (reactObj.react === 'smile') {
                        document.getElementById('message-emoji-smile'+messageObj.id).classList.add('emoji_check');
                        msgs_flags[messageObj.id]['smile'] = true;
                    } else if (reactObj.react === 'angry') {
                        document.getElementById('message-emoji-angry'+messageObj.id).classList.add('emoji_check');
                        msgs_flags[messageObj.id]['angry'] = true;
                    } 
                }

                //add click listeners to the emoji
                const emoji_EventListener = (emoji) => {
                    const emoji_id = `message-emoji-${emoji}`+messageObj.id;
                    const body={
                        "react": emoji
                    };

                    document.querySelector(`#${emoji_id}`).addEventListener('click', () => {
                        if(msgs_flags[messageObj.id][emoji]){
                            makeRequest('/message/unreact/'+`${channelIdCurrent}/${messageObj.id}`, 'POST', body)
                            .then(data => {
                                document.querySelector(`#${emoji_id}`).classList.remove('emoji_check');
                                if (msgs_flags[messageObj.id]){
                                    const another_emoji_id = `pinned-message-emoji-${emoji}`+messageObj.id;
                                    document.querySelector(`#${another_emoji_id}`).classList.remove('emoji_check');
                                }
                                msgs_flags[messageObj.id][emoji] =false;
                            })
                            .catch(err => {
                                errorPopup(err);
                            })
                        }else{
                            makeRequest('/message/react/'+`${channelIdCurrent}/${messageObj.id}`, 'POST', body)
                            .then(data => {
                                document.querySelector(`#${emoji_id}`).classList.add('emoji_check');
                                if (msgs_flags[messageObj.id]){
                                    const another_emoji_id = `pinned-message-emoji-${emoji}`+messageObj.id;
                                    document.querySelector(`#${another_emoji_id}`).classList.add('emoji_check');
                                }
                                msgs_flags[messageObj.id][emoji] =true;
                            })
                            .catch(err => {
                                errorPopup(err);
                            })
                        }
                    });
                }

                emoji_EventListener('like');
                emoji_EventListener('smile');
                emoji_EventListener('angry');
                

                document.getElementById('message-div'+messageObj.id).appendChild(senderInfoDiv);
                document.getElementById('sender-info'+messageObj.id).appendChild(senderNameSpan);
                document.getElementById('sender-info'+messageObj.id).appendChild(senderPhotoImg);
                document.getElementById('sender-info'+messageObj.id).appendChild(senderTimestampSpan);

                if (messageObj.sender === userId) {
                    const deleteMessageButton = document.createElement('button');
                    deleteMessageButton.classList.add('delete-message-button');
                    deleteMessageButton.innerText = 'Delete';
                    document.getElementById('sender-info'+messageObj.id).appendChild(deleteMessageButton);

                    //delete message
                    deleteMessageButton.onclick = () => {
                        makeRequest('/message/'+channelId+'/'+ messageObj.id, 'DELETE', undefined)
                        .then(() => {
                            displayChannel(channelId);
                            // displayChannel_get_msgs(channelId,startindex);
                            // displayChannel_get_pinned(channelId);
                        })
                        .catch((error) => {
                            errorPopup(error);
                        });
                    };

                    const editMessageButton = document.createElement('button');
                    editMessageButton.id='edit-message-button'+messageObj.id;
                    editMessageButton.innerText = 'Edit';
                    document.getElementById('sender-info'+messageObj.id).appendChild(editMessageButton);
                    
                    const editMessageConfirmButton = document.createElement('button');
                    editMessageConfirmButton.id='edit-message-confirm-button'+messageObj.id;
                    editMessageConfirmButton.innerText = 'Confirm editing';
                    editMessageConfirmButton.classList.add('hide');
                    document.getElementById('sender-info'+messageObj.id).appendChild(editMessageConfirmButton);

                    //Upon clicking the edit message button, show the edit message state
                    editMessageButton.onclick = () => {
                        document.getElementById('sender-message'+messageObj.id).style.backgroundColor = "white";
                        document.getElementById('sender-message'+messageObj.id).contentEditable = true;
                        document.getElementById('edit-message-confirm-button'+messageObj.id).classList.remove('hide');
                        document.getElementById('sender-message'+messageObj.id).focus();
                        document.getElementById('sender-message'+messageObj.id).addEventListener('focusout', (event) => {
                            document.getElementById('sender-message'+messageObj.id).contentEditable = false;
                            document.getElementById('sender-message'+messageObj.id).style.backgroundColor = "transparent";
                            document.getElementById('edit-message-confirm-button'+messageObj.id).classList.add('hide');
                        });
                    }

                    //Upon clicking the confirm editing button, send the edited message to the server
                    document.getElementById('edit-message-confirm-button'+messageObj.id).addEventListener('mousedown',() => {
                        const message =document.getElementById('sender-message'+messageObj.id).innerText;
                        if (message===messageObj.message){
                            errorPopup('Cannot edit a message to the same existing message');
                            return;
                        } 

                        const image = document.getElementById('sender-photo'+messageObj.id).src;
                        const body = { 
                            "message": message,
                            "image": image
                        };
                        makeRequest('/message/'+channelId+'/'+ messageObj.id, 'PUT', body)
                        .then(() => {
                            document.getElementById('sender-message'+messageObj.id).style.backgroundColor = null;
                            document.getElementById('sender-message'+messageObj.id).contentEditable = false;
                            document.getElementById('edit-message-confirm-button'+messageObj.id).classList.add('hide');
                            displayChannel(channelId);
                            // displayChannel_get_msgs(channelId,startindex);
                            // displayChannel_get_pinned(channelId);
                        })
                        .catch((error) => {
                            errorPopup(error);
                        });
                    });
                    
                }

                //create a pin/unpin message button
                const msgPin_UnpinButton = document.createElement('button');
                msgPin_UnpinButton.id='message-PinUnpin-button'+messageObj.id;
                msgPin_UnpinButton.innerText = 'Pin/Unpin';
                document.getElementById('sender-info'+messageObj.id).appendChild(msgPin_UnpinButton);

                //Unon clicking the pin/unpin button, pin/unpin the message to the server
                msgPin_UnpinButton.onclick = () => {
                    if (msgs_pin_flags[messageObj.id]){
                        makeRequest('/message/unpin/'+channelId+'/'+ messageObj.id, 'POST', undefined)
                        .then(() => {
                            // displayChannel(channelId);
                            displayChannel_get_pinned(channelId);
                            msgs_pin_flags[messageObj.id] = false;
                        })
                    } else {
                        makeRequest('/message/pin/'+channelId+'/'+ messageObj.id, 'POST', undefined)
                        .then(() => {
                            // displayChannel(channelId);
                            displayChannel_get_pinned(channelId);
                            msgs_pin_flags[messageObj.id] = true;
                            
                        })
                    }
                };

                document.getElementById('channel-messages-body').appendChild(document.createElement('hr'));
            };
            return data.messages.length;
        })
        .catch(error => {
            console.error(error);
            document.getElementById('invite-button').disabled = true;
            errorPopup("Wanna see this channel's messages? Join it first!");
        });

    const await_get_msgs = async() => {
        const a = await get_msg_promise;
        return a;
    };
    const amsg=await_get_msgs();
    return amsg;
};


//a function that gets the messages in the channel
function loadmsgs() {
    if (msgs_len === 0) {
        // document.getElementById('loading').classList.add('hide');
        return;
    }
    const x = displayChannel_get_msgs(channelIdCurrent,startindex);
    x.then((data) => {
        msgs_len=data;
        startindex += 25;
        // document.getElementById('loading').classList.add('hide');
    })
    .catch((error) => {
        console.error(error);
    });
}

let lastScrollTop = 0;
//infinite scroll
window.addEventListener('scroll',()=>{ 
    let st = window.pageYOffset || document.documentElement.scrollTop;
    //if downscroll
    if (st > lastScrollTop){
        //if reach the bottom
        if(document.documentElement.scrollTop + window.innerHeight >= document.documentElement.scrollHeight){
            // document.getElementById('loading').classList.remove('hide');
            loadmsgs();
            if (msgs_len !== 0){
                alert('Loading more messages, please wait');
            }
        }
    } 
    lastScrollTop = st <= 0 ? 0 : st; // For Mobile or negative scrolling
});

//display a certain channel
const displayChannel = (channelId) => {
    channelIdCurrent = channelId;
    document.getElementById('Current-channel-section').classList.remove('hide');
    //upadte channel name, description, type, timestamp and creator
    document.getElementById('channel-name').value=null;
    document.getElementById('channel-description').value=null;
    document.getElementById('channel-type').innerText = '';
    document.getElementById('channel-timestamp').innerText = '';
    document.getElementById('channel-creator').innerText = '';
    //update the channel's messages
    document.getElementById('channel-messages-body').remove();
    const newchannel_messages_body = document.createElement('div');
    newchannel_messages_body.id = 'channel-messages-body';
    document.getElementById('channel-messages').appendChild(newchannel_messages_body);
    const msg_header=document.createElement('p');
    msg_header.innerText ='Channel Messages';
    msg_header.style.fontWeight='bold';
    msg_header.style.fontSize='20px';
    document.getElementById('channel-messages-body').appendChild(msg_header);
    document.getElementById('channel-messages-body').appendChild(document.createElement('hr'));
    //get the info section of the channel
    displayChannel_get_info(channelId);

    displayChannel_get_pinned(channelId);
    msgs_len = null;
    startindex = 0;
    loadmsgs();

};


//display channels in the channel list
const displayChannels = () => {
    //update the public channels
    document.getElementById('public-channels-body').remove();
    const newpublic_channels_body = document.createElement('div');
    newpublic_channels_body.id = 'public-channels-body';
    document.getElementById('public-channels-list').appendChild(newpublic_channels_body);
    //update the private channels
    document.getElementById('private-channels-body').remove();
    const newprivate_channels_body = document.createElement('div');
    newprivate_channels_body.id = 'private-channels-body';
    document.getElementById('private-channels-list').appendChild(newprivate_channels_body);
    //display all the channels
    makeRequest('/channel', 'GET', undefined)
    .then(data => {
        for (const channel of data.channels) {
            const link = document.createElement('a');
            link.innerText = channel.name;
            if (channel.private === true) {
                document.getElementById('private-channels-body').appendChild(link);
            } else {
                document.getElementById('public-channels-body').appendChild(link);
            }
            link.addEventListener('mousedown', () => {
                document.body.scrollTop = document.body.scrollHeight;
                window.scrollY = 0;
                document.documentElement.scrollTop = 0;
            });
            link.addEventListener('mouseup', () => {
                displayChannel(channel.id);
            });
        };
    })
    .catch(error => {
        errorPopup(error);
    });
}; 

//when logout, change the page's structure to the logged-out page
const logout = () => {
    document.getElementById('logged-in').classList.add('hide');
    document.getElementById('logged-out').classList.remove('hide');
    token = null;
    userId = null;
};

//when login, change the page's structure to the logged-in page
const login = () => {
    document.getElementById('logged-out').classList.add('hide');
    document.getElementById('logged-in').classList.remove('hide');
    displayChannels();
};

//switch to the login page by clicking the blue login button
document.getElementById('nav-login').addEventListener('click', () => {
    document.getElementById('register').classList.add('hide');
    document.getElementById('login').classList.remove('hide');
});

//switch to the register page by clicking the blue register button
document.getElementById('nav-register').addEventListener('click', () => {
    document.getElementById('login').classList.add('hide');
    document.getElementById('register').classList.remove('hide');
});


//click the create-channel button to show a form
document.getElementById('create-channel').addEventListener('click', () => {
    document.getElementById('channel-form').classList.remove('hide');
    document.getElementById('create-form').classList.remove('hide');
});

//click the close-channel-form button to hide the form
document.getElementById('close-channel-form').addEventListener('click', () => {
    document.getElementById('channel-form').classList.add('hide');
    document.getElementById('create-form').classList.add('hide');
});

//click the change-channel-info button to change the channel's info
document.getElementById('change-channel-info-action').addEventListener('click', () => {
    const channel_name = document.getElementById('channel-name').value;
    const channel_description = document.getElementById('channel-description').value;
    const body = { 
        "name": channel_name,
        "description": channel_description
    };
    makeRequest('/channel/'+channelIdCurrent, 'PUT', body)
    .then(data => {
       displayChannels();
       displayChannel(channelIdCurrent);
    })
    .catch(error => {
        errorPopup(error);
    });
});

//click the join-channel-action button to join the channel
document.getElementById('join-channel-action').addEventListener('click', () => {
    makeRequest('/channel/'+channelIdCurrent+'/join', 'POST', undefined)
    .then(data => {
        displayChannel(channelIdCurrent);
    })
    .catch(error => {
        errorPopup(error);
    });
});

//click the leave-channel-action button to leave the channel
document.getElementById('leave-channel-action').addEventListener('click', () => {
    makeRequest('/channel/'+channelIdCurrent+'/leave', 'POST', undefined)
    .then(data => {
        displayChannel(channelIdCurrent);
    })
    .catch(error => {
        errorPopup(error);
    });
});

//Upon clicking invite button, get the invite names list in the modal
document.getElementById('invite-button').addEventListener('mousedown', () => {
    makeRequest('/user', 'GET', undefined)
    .then(data => {
        //update #myMulti and the dive inside .drop-options
        document.getElementById('myMulti').remove();
        const newselect = document.createElement('select');
        newselect.multiple = 'multiple';
        newselect.id = 'myMulti';
        document.querySelector('.drop-options').appendChild(newselect);
        document.querySelector('.drop-options').querySelector('div').remove();
        const div = document.createElement('div');
        document.querySelector('.drop-options').appendChild(div);
        //use user id to get the user name, then display users' name in the modal
        let index=0
        for (const user of data.users){
            if (user.id === userId){
                continue;
            }
            const option = document.createElement('option');
            let user_name=getUserName(user.id)
            .then((data) => {
                users_dict[data] = user.id;
                option.innerText = data;
                document.getElementById('myMulti').appendChild(option);
                const a = document.createElement('a');
                a.setAttribute('data-index', `${index}`);
                a.setAttribute('class','');
                a.innerText = data;
                document.querySelector('.drop-options').querySelector('div').appendChild(a);
                index++;
            })
            .catch(error => {
                index++;
                errorPopup(error);
            });
        }
        // jQuery('#myMulti').multiselect('rebuild');
    })
    .catch(error => {
        errorPopup(error);
    });
});

//Upon clicking the confirm invite button, get the names and then make the invite request
document.getElementById('confirm-invite-button').addEventListener('mousedown', () => {
    //get the selected names
    let selectedItems = [];
    const selecteds = document.querySelectorAll('.item:not(.hide)');
    for (let selected of selecteds){
        if (selected in selectedItems){
            continue;
        }
        selectedItems.push(selected.firstChild);
    }
    //for each selected name, make the invite request
    for (let selected of selectedItems){
        const user_id = users_dict[selected];
        const body = {
            "user_id": user_id
        };
        makeRequest('/channel/'+channelIdCurrent+'/invite', 'POST', body)
        .then(data => {
            displayChannel(channelIdCurrent);
        })
        .catch(error => {
            errorPopup(error);
        });
    }
});

