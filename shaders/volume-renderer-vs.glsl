varying vec3 worldSpaceCoords;
varying vec4 projectedCoords;

vec3 toLocal(vec3 p) {
		return p + vec3(0.5);
}

void main()
{
	worldSpaceCoords = (modelMatrix * vec4(toLocal(position), 1.0 )).xyz;
	gl_Position = projectionMatrix *  modelViewMatrix * vec4( position, 1.0 );
	projectedCoords =  projectionMatrix * modelViewMatrix * vec4( position, 1.0 );
}